using EY.HRPlatform.Performance.Domain.Enums;
using EY.HRPlatform.Performance.Exceptions;
using EY.HRPlatform.Performance.Features.Security;
using EY.HRPlatform.Performance.Infrastructure.Persistence;
using EY.HRPlatform.SharedKernel.CQRS;
using EY.HRPlatform.SharedKernel.Results;
using Microsoft.EntityFrameworkCore;

namespace EY.HRPlatform.Performance.Features.Milestones.Commands;

public sealed record CompleteMilestoneCommand(Guid MilestoneId) : ICommand<Result>;

public sealed class CompleteMilestoneCommandHandler(
    PerformanceDbContext dbContext,
    ICurrentUserContext currentUser) : ICommandHandler<CompleteMilestoneCommand, Result>
{
    public async Task<Result> Handle(CompleteMilestoneCommand request, CancellationToken cancellationToken)
    {
        if (!currentUser.EmployeeId.HasValue)
            return Result.Failure(Error.Forbidden("Milestone.EmployeeContextRequired", "An employee context is required to complete a milestone."));

        var milestone = await dbContext.PerformanceObjectiveMilestones
            .SingleOrDefaultAsync(m => m.Id == request.MilestoneId, cancellationToken);
        if (milestone is null)
            return Result.Failure(Error.NotFound("PerformanceObjectiveMilestone", request.MilestoneId));

        var objective = await dbContext.PerformanceObjectives
            .SingleOrDefaultAsync(o => o.Id == milestone.ObjectiveId, cancellationToken);
        if (objective is null)
            return Result.Failure(Error.NotFound("PerformanceObjective", milestone.ObjectiveId));

        // Owner check (D-13)
        if (objective.OwnerEmployeeId != currentUser.EmployeeId.Value)
            return Result.Failure(Error.Forbidden("Milestone.NotOwner", "Only the objective owner can complete milestones."));

        // Progress-window check: objective must be Approved and campaign must be Active
        if (objective.Status != ObjectiveStatus.Approved)
            return Result.Failure(Error.Conflict("Milestone.ObjectiveNotApproved", "Milestones can only be completed on approved objectives."));

        var cycle = await dbContext.PerformanceCycles
            .SingleOrDefaultAsync(c => c.Id == objective.CycleId, cancellationToken);
        if (cycle is null || cycle.Status != PerformanceCycleStatus.Active)
            return Result.Failure(Error.Conflict("Milestone.CampaignNotActive", "Milestones can only be completed while the campaign is active."));

        try
        {
            milestone.Complete(DateTime.UtcNow);
        }
        catch (InvalidOperationException ex)
        {
            return Result.Failure(Error.Conflict("Milestone.AlreadyCompleted", ex.Message));
        }

        // When objective mode is MilestoneRollup, write an append-only ObjectiveProgressEntry (D-14)
        if (objective.ProgressMode == ObjectiveProgressMode.MilestoneRollup)
        {
            var totalMilestones = await dbContext.PerformanceObjectiveMilestones
                .CountAsync(m => m.ObjectiveId == objective.Id, cancellationToken);
            var completedCount = await dbContext.PerformanceObjectiveMilestones
                .CountAsync(m => m.ObjectiveId == objective.Id && m.IsCompleted, cancellationToken);

            // The milestone we just completed is in-memory but not yet saved, so +1
            var effectiveCompleted = completedCount + 1;
            var newPercent = totalMilestones > 0 ? (decimal)effectiveCompleted / totalMilestones * 100 : 0;

            var entry = Domain.Entities.ObjectiveProgressEntry.Create(
                objective.TenantId,
                objective.Id,
                currentUser.EmployeeId.Value,
                currentUser.FullName,
                ObjectiveProgressMode.MilestoneRollup,
                previousPercent: null, // MilestoneRollup doesn't track previous percent on the objective
                newPercent: Math.Round(newPercent, 2),
                source: "OwnerUpdate");
            dbContext.ObjectiveProgressEntries.Add(entry);
        }

        // D-14: routine owner milestone complete does NOT emit governance audit events
        await dbContext.SaveChangesAsync(cancellationToken);
        return Result.Success();
    }
}
