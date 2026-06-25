using EY.HRPlatform.Performance.Domain.Enums;
using EY.HRPlatform.Performance.Exceptions;
using EY.HRPlatform.Performance.Features.Security;
using EY.HRPlatform.Performance.Infrastructure.Persistence;
using EY.HRPlatform.SharedKernel.CQRS;
using EY.HRPlatform.SharedKernel.Results;
using Microsoft.EntityFrameworkCore;

namespace EY.HRPlatform.Performance.Features.Milestones.Commands;

public sealed record AddMilestoneCommand(Guid ObjectiveId, string Title, DateTime DueDate) : ICommand<Result<Guid>>;

public sealed class AddMilestoneCommandHandler(
    PerformanceDbContext dbContext,
    ICurrentUserContext currentUser) : ICommandHandler<AddMilestoneCommand, Result<Guid>>
{
    public async Task<Result<Guid>> Handle(AddMilestoneCommand request, CancellationToken cancellationToken)
    {
        if (!currentUser.EmployeeId.HasValue)
            return Result.Failure<Guid>(Error.Forbidden("Milestone.EmployeeContextRequired", "An employee context is required to add a milestone."));

        var objective = await dbContext.PerformanceObjectives
            .SingleOrDefaultAsync(o => o.Id == request.ObjectiveId, cancellationToken);
        if (objective is null)
            return Result.Failure<Guid>(Error.NotFound("PerformanceObjective", request.ObjectiveId));

        // Owner check (D-13)
        if (objective.OwnerEmployeeId != currentUser.EmployeeId.Value)
            return Result.Failure<Guid>(Error.Forbidden("Milestone.NotOwner", "Only the objective owner can add milestones."));

        // Progress-window check: objective must be Approved and campaign must be Active
        if (objective.Status != ObjectiveStatus.Approved)
            return Result.Failure<Guid>(Error.Conflict("Milestone.ObjectiveNotApproved", "Milestones can only be added to approved objectives."));

        var cycle = await dbContext.PerformanceCycles
            .SingleOrDefaultAsync(c => c.Id == objective.CycleId, cancellationToken);
        if (cycle is null || cycle.Status != PerformanceCycleStatus.Active)
            return Result.Failure<Guid>(Error.Conflict("Milestone.CampaignNotActive", "Milestones can only be added while the campaign is active."));

        var milestone = Domain.Entities.PerformanceObjectiveMilestone.Create(
            objective.TenantId, objective.Id, request.Title, request.DueDate);
        dbContext.PerformanceObjectiveMilestones.Add(milestone);
        await dbContext.SaveChangesAsync(cancellationToken);
        return milestone.Id;
    }
}
