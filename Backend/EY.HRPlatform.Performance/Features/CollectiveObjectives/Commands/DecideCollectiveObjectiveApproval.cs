using EY.HRPlatform.Performance.Domain.Enums;
using EY.HRPlatform.Performance.Exceptions;
using EY.HRPlatform.Performance.Features.Objectives.Commands;
using EY.HRPlatform.Performance.Features.Security;
using EY.HRPlatform.Performance.Infrastructure.Persistence;
using EY.HRPlatform.SharedKernel.CQRS;
using EY.HRPlatform.SharedKernel.Results;
using Microsoft.EntityFrameworkCore;

namespace EY.HRPlatform.Performance.Features.CollectiveObjectives.Commands;

/// <summary>
/// Approves, returns, or rejects a collective objective through the assigned
/// TeamObjectiveApproval work item. Gates on CanApproveCollectiveObjectives (D-15).
/// </summary>
public sealed record DecideCollectiveObjectiveApprovalCommand(
    Guid ObjectiveId,
    Guid WorkItemId,
    ObjectiveApprovalDecision Decision) : ICommand<Result>;

public sealed class DecideCollectiveObjectiveApprovalCommandHandler(
    PerformanceDbContext dbContext,
    ICurrentUserContext currentUser,
    IPerformanceAccessPolicyService accessPolicy,
    IHttpContextAccessor httpContextAccessor) : ICommandHandler<DecideCollectiveObjectiveApprovalCommand, Result>
{
    public async Task<Result> Handle(DecideCollectiveObjectiveApprovalCommand request, CancellationToken cancellationToken)
    {
        if (!currentUser.EmployeeId.HasValue)
            return Result.Failure(Error.Forbidden("Collective.EmployeeContextRequired",
                "An employee context is required to decide a collective objective approval."));

        // D-15: deny-by-default — must have collective approval permission
        if (!accessPolicy.CanApproveCollectiveObjectives(httpContextAccessor.HttpContext!.User))
            return Result.Failure(Error.Forbidden("Collective.ApprovalForbidden",
                "You do not have permission to approve collective objectives."));

        var objective = await dbContext.PerformanceObjectives
            .FirstOrDefaultAsync(o => o.Id == request.ObjectiveId, cancellationToken);

        if (objective is null)
            return Result.Failure(Error.NotFound("PerformanceObjective", request.ObjectiveId));

        var workItem = await dbContext.CampaignWorkItems
            .FirstOrDefaultAsync(w => w.Id == request.WorkItemId, cancellationToken);

        if (workItem is null)
            return Result.Failure(Error.NotFound("CampaignWorkItem", request.WorkItemId));

        // Gate: must be a TeamObjectiveApproval work item assigned to the current employee
        if (workItem.Type != CampaignWorkItemType.TeamObjectiveApproval ||
            workItem.CycleId != objective.CycleId ||
            workItem.SubjectEmployeeId != objective.OwnerEmployeeId ||
            workItem.AssigneeEmployeeId != currentUser.EmployeeId.Value)
        {
            return Result.Failure(Error.Forbidden("Collective.ApprovalNotAssigned",
                "The current employee is not assigned to approve this collective objective."));
        }

        try
        {
            switch (request.Decision)
            {
                case ObjectiveApprovalDecision.Approve:
                    objective.Approve(DateTime.UtcNow);
                    break;
                case ObjectiveApprovalDecision.Return:
                    objective.Return(DateTime.UtcNow);
                    break;
                case ObjectiveApprovalDecision.Reject:
                    objective.Reject(DateTime.UtcNow);
                    break;
                default:
                    return Result.Failure(Error.Validation("Collective.InvalidApprovalDecision",
                        "An approval decision is required."));
            }

            workItem.Submit(DateTime.UtcNow);
            workItem.Complete(DateTime.UtcNow);
            await dbContext.SaveChangesAsync(cancellationToken);
            return Result.Success();
        }
        catch (DomainRuleViolationException exception)
        {
            return Result.Failure(Error.Conflict("Collective.InvalidTransition", exception.Message));
        }
    }
}
