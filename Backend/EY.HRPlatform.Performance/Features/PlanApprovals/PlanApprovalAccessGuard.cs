using EY.HRPlatform.Performance.Domain.Entities;
using EY.HRPlatform.Performance.Features.Security;
using EY.HRPlatform.Performance.Infrastructure.Persistence;
using EY.HRPlatform.SharedKernel.Results;
using Microsoft.EntityFrameworkCore;

namespace EY.HRPlatform.Performance.Features.PlanApprovals;

public sealed class PlanApprovalAccessGuard(
    PerformanceDbContext dbContext,
    ICurrentUserContext currentUser)
{
    public async Task<Result<PlanApprovalScope>> RequirePlanApprovalScopeAsync(
        Guid cycleId,
        Guid planId,
        CancellationToken cancellationToken)
    {
        var approverEmployeeId = currentUser.EmployeeId;
        if (!approverEmployeeId.HasValue)
            return Result.Failure<PlanApprovalScope>(Error.Forbidden(
                "PlanApproval.EmployeeContextForbidden",
                "Your account is not linked to an employee record."));

        var plan = await dbContext.EmployeeObjectivePlans
            .Include(item => item.Objectives)
            .Include(item => item.ReviewEvents)
            .FirstOrDefaultAsync(item => item.Id == planId && item.CycleId == cycleId, cancellationToken);

        if (plan is null)
            return Result.Failure<PlanApprovalScope>(Error.NotFound("EmployeeObjectivePlan", planId));

        var participant = await dbContext.PerformanceCycleParticipants
            .AsNoTracking()
            .FirstOrDefaultAsync(
                item => item.CycleId == cycleId && item.EmployeeId == plan.EmployeeId,
                cancellationToken);

        if (participant is null)
            return Result.Failure<PlanApprovalScope>(Error.NotFound("PerformanceCycleParticipant", plan.EmployeeId));

        if (participant.ApproverEmployeeId != approverEmployeeId.Value)
            return Result.Failure<PlanApprovalScope>(Error.Forbidden(
                "PlanApproval.NotFrozenApproverForbidden",
                "Only the frozen plan approver can review this objective plan."));

        if (participant.EmployeeId == approverEmployeeId.Value)
            return Result.Failure<PlanApprovalScope>(Error.Conflict(
                "PlanApproval.SelfApprovalDataIssue",
                "The frozen approver is the same person as the employee, so this plan cannot be approved."));

        return Result.Success(new PlanApprovalScope(plan, participant));
    }
}

public sealed record PlanApprovalScope(EmployeeObjectivePlan Plan, PerformanceCycleParticipant Participant);
