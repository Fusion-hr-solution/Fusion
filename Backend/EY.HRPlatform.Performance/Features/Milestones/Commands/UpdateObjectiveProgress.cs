using EY.HRPlatform.Performance.Domain.Entities;
using EY.HRPlatform.Performance.Domain.Enums;
using EY.HRPlatform.Performance.Exceptions;
using EY.HRPlatform.Performance.Features.Security;
using EY.HRPlatform.Performance.Infrastructure.Persistence;
using EY.HRPlatform.SharedKernel.CQRS;
using EY.HRPlatform.SharedKernel.Results;
using Microsoft.EntityFrameworkCore;

namespace EY.HRPlatform.Performance.Features.Milestones.Commands;

public sealed record UpdateObjectiveProgressCommand(Guid ObjectiveId, decimal Percent, string? Comment) : ICommand<Result>;

public sealed class UpdateObjectiveProgressCommandHandler(
    PerformanceDbContext dbContext,
    ICurrentUserContext currentUser) : ICommandHandler<UpdateObjectiveProgressCommand, Result>
{
    public async Task<Result> Handle(UpdateObjectiveProgressCommand request, CancellationToken cancellationToken)
    {
        if (!currentUser.EmployeeId.HasValue)
            return Result.Failure(Error.Forbidden("Progress.EmployeeContextRequired", "An employee context is required to update progress."));

        var objective = await dbContext.PerformanceObjectives
            .SingleOrDefaultAsync(o => o.Id == request.ObjectiveId, cancellationToken);
        if (objective is null)
            return Result.Failure(Error.NotFound("PerformanceObjective", request.ObjectiveId));

        // Owner check (D-13)
        if (objective.OwnerEmployeeId != currentUser.EmployeeId.Value)
            return Result.Failure(Error.Forbidden("Progress.NotOwner", "Only the objective owner can update progress."));

        // Progress-window check: objective must be Approved and campaign must be Active
        if (objective.Status != ObjectiveStatus.Approved)
            return Result.Failure(Error.Conflict("Progress.ObjectiveNotApproved", "Progress can only be updated on approved objectives."));

        var cycle = await dbContext.PerformanceCycles
            .SingleOrDefaultAsync(c => c.Id == objective.CycleId, cancellationToken);
        if (cycle is null || cycle.Status != PerformanceCycleStatus.Active)
            return Result.Failure(Error.Conflict("Progress.CampaignNotActive", "Progress can only be updated while the campaign is active."));

        // D-12: mode-conflict guard — reject manual update on MilestoneRollup objective
        if (objective.ProgressMode == ObjectiveProgressMode.MilestoneRollup)
            return Result.Failure(Error.Conflict("Progress.ModeMismatch", "Objective uses MilestoneRollup tracking; manual percent updates are not allowed."));

        var previousPercent = objective.ManualProgressPercent;

        try
        {
            objective.SetManualProgress(request.Percent, DateTime.UtcNow);
        }
        catch (DomainRuleViolationException ex)
        {
            return Result.Failure(Error.Conflict("Progress.InvalidUpdate", ex.Message));
        }
        catch (ArgumentOutOfRangeException ex)
        {
            return Result.Failure(Error.Validation("Progress.InvalidPercent", ex.Message));
        }

        // Append-only progress history (D-14)
        var entry = ObjectiveProgressEntry.Create(
            objective.TenantId,
            objective.Id,
            currentUser.EmployeeId.Value,
            currentUser.FullName,
            ObjectiveProgressMode.ManualPercent,
            previousPercent,
            request.Percent,
            "OwnerUpdate",
            request.Comment);
        dbContext.ObjectiveProgressEntries.Add(entry);

        // D-14: routine owner update does NOT emit governance audit event
        await dbContext.SaveChangesAsync(cancellationToken);
        return Result.Success();
    }
}
