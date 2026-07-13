using EY.HRPlatform.Performance.Domain.Enums;
using EY.HRPlatform.Performance.Features.PlanApprovals.Dtos;
using EY.HRPlatform.Performance.Features.Security;
using EY.HRPlatform.Performance.Infrastructure.Persistence;
using EY.HRPlatform.SharedKernel.CQRS;
using EY.HRPlatform.SharedKernel.Results;
using Microsoft.EntityFrameworkCore;

namespace EY.HRPlatform.Performance.Features.PlanApprovals.Queries;

public sealed record GetPlanApprovalWorkspaceQuery(string Slug) : IQuery<Result<PlanApprovalWorkspaceDto>>;

public sealed class GetPlanApprovalWorkspaceQueryHandler(
    PerformanceDbContext dbContext,
    ICurrentUserContext currentUser) : IQueryHandler<GetPlanApprovalWorkspaceQuery, Result<PlanApprovalWorkspaceDto>>
{
    public async Task<Result<PlanApprovalWorkspaceDto>> Handle(
        GetPlanApprovalWorkspaceQuery request,
        CancellationToken cancellationToken)
    {
        var approverEmployeeId = currentUser.EmployeeId;
        if (!approverEmployeeId.HasValue)
            return Result.Failure<PlanApprovalWorkspaceDto>(Error.Forbidden(
                "PlanApproval.EmployeeContextForbidden",
                "Your account is not linked to an employee record."));

        var slug = (request.Slug ?? string.Empty).Trim().ToLowerInvariant();
        var cycle = await dbContext.PerformanceCycles
            .AsNoTracking()
            .FirstOrDefaultAsync(item => item.Slug == slug, cancellationToken);

        if (cycle is null)
            return Result.Failure<PlanApprovalWorkspaceDto>(
                new Error("PerformanceCycle.NotFound", $"Campaign '{slug}' was not found."));

        if (cycle.Status != PerformanceCycleStatus.Launched)
            return Result.Failure<PlanApprovalWorkspaceDto>(Error.Validation(
                "PlanApproval.NotLaunchedInvalid",
                "This campaign is not launched for objective planning yet."));

        var participants = await dbContext.PerformanceCycleParticipants
            .AsNoTracking()
            .Where(participant => participant.CycleId == cycle.Id && participant.ApproverEmployeeId == approverEmployeeId.Value)
            .OrderBy(participant => participant.FullName)
            .ToListAsync(cancellationToken);

        if (participants.Count == 0)
            return Result.Failure<PlanApprovalWorkspaceDto>(Error.Forbidden(
                "PlanApproval.NotFrozenApproverForbidden",
                "This campaign does not assign you any objective plans to approve."));

        var employeeIds = participants.Select(participant => participant.EmployeeId).ToList();
        var participantByEmployeeId = participants.ToDictionary(participant => participant.EmployeeId);

        var plans = await dbContext.EmployeeObjectivePlans
            .AsNoTracking()
            .Include(plan => plan.Objectives)
            .Include(plan => plan.ReviewEvents)
            .Where(plan => plan.CycleId == cycle.Id
                           && employeeIds.Contains(plan.EmployeeId)
                           && plan.Status != PlanStatus.Draft)
            .ToListAsync(cancellationToken);

        var reviews = plans
            .OrderBy(plan => plan.Status == PlanStatus.Submitted ? 0 : plan.Status == PlanStatus.ChangesRequested ? 1 : 2)
            .ThenBy(plan => plan.SubmittedAt)
            .Select(plan =>
            {
                var participant = participantByEmployeeId[plan.EmployeeId];
                return PlanApprovalMapper.ToReviewDto(
                    plan,
                    participant,
                    participant.EmployeeId == approverEmployeeId.Value);
            })
            .ToList();

        return Result.Success(new PlanApprovalWorkspaceDto(
            cycle.Id,
            cycle.Slug,
            cycle.Name,
            cycle.ReferenceYear,
            cycle.PlanningOpeningDate,
            cycle.EmployeeSubmissionDeadline,
            cycle.ManagerApprovalDeadline,
            cycle.LaunchedAt,
            reviews.Count(plan => plan.Status == PlanStatus.Submitted && !plan.IsSelfApprovalDataIssue),
            reviews.Count(plan => plan.Status == PlanStatus.ChangesRequested),
            reviews.Count(plan => plan.Status == PlanStatus.Approved),
            reviews.Count(plan => plan.IsSelfApprovalDataIssue),
            reviews));
    }
}
