using EY.HRPlatform.Performance.Domain.Enums;
using EY.HRPlatform.Performance.Features.PlanApprovals.Dtos;
using EY.HRPlatform.Performance.Features.Security;
using EY.HRPlatform.Performance.Infrastructure.Persistence;
using EY.HRPlatform.SharedKernel.CQRS;
using EY.HRPlatform.SharedKernel.Results;
using Microsoft.EntityFrameworkCore;

namespace EY.HRPlatform.Performance.Features.PlanApprovals.Queries;

public sealed record GetMyPlanApprovalCampaignsQuery() : IQuery<Result<IReadOnlyList<PlanApprovalCampaignDto>>>;

public sealed class GetMyPlanApprovalCampaignsQueryHandler(
    PerformanceDbContext dbContext,
    ICurrentUserContext currentUser) : IQueryHandler<GetMyPlanApprovalCampaignsQuery, Result<IReadOnlyList<PlanApprovalCampaignDto>>>
{
    public async Task<Result<IReadOnlyList<PlanApprovalCampaignDto>>> Handle(
        GetMyPlanApprovalCampaignsQuery request,
        CancellationToken cancellationToken)
    {
        var employeeId = currentUser.EmployeeId;
        if (!employeeId.HasValue)
            return Result.Success<IReadOnlyList<PlanApprovalCampaignDto>>([]);

        var participants = await dbContext.PerformanceCycleParticipants
            .AsNoTracking()
            .Where(participant => participant.ApproverEmployeeId == employeeId.Value)
            .ToListAsync(cancellationToken);

        if (participants.Count == 0)
            return Result.Success<IReadOnlyList<PlanApprovalCampaignDto>>([]);

        var cycleIds = participants.Select(participant => participant.CycleId).Distinct().ToList();
        var cycles = await dbContext.PerformanceCycles
            .AsNoTracking()
            .Where(cycle => cycleIds.Contains(cycle.Id) && cycle.Status == PerformanceCycleStatus.Launched)
            .ToListAsync(cancellationToken);

        var launchedCycleIds = cycles.Select(cycle => cycle.Id).ToHashSet();
        var participantKeys = participants
            .Where(participant => launchedCycleIds.Contains(participant.CycleId))
            .Select(participant => new { participant.CycleId, participant.EmployeeId })
            .ToHashSet();

        var plans = await dbContext.EmployeeObjectivePlans
            .AsNoTracking()
            .Where(plan => launchedCycleIds.Contains(plan.CycleId) && plan.Status != PlanStatus.Draft)
            .ToListAsync(cancellationToken);

        var scopedPlans = plans
            .Where(plan => participantKeys.Contains(new { plan.CycleId, plan.EmployeeId }))
            .ToList();

        var campaigns = cycles
            .OrderByDescending(cycle => cycle.LaunchedAt)
            .Select(cycle =>
            {
                var cyclePlans = scopedPlans.Where(plan => plan.CycleId == cycle.Id).ToList();
                var selfIssueEmployeeIds = participants
                    .Where(participant => participant.CycleId == cycle.Id && participant.EmployeeId == employeeId.Value)
                    .Select(participant => participant.EmployeeId)
                    .ToHashSet();

                return new PlanApprovalCampaignDto(
                    cycle.Id,
                    cycle.Slug,
                    cycle.Name,
                    cycle.ReferenceYear,
                    cycle.PlanningOpeningDate,
                    cycle.EmployeeSubmissionDeadline,
                    cycle.ManagerApprovalDeadline,
                    cycle.LaunchedAt,
                    cyclePlans.Count(plan => plan.Status == PlanStatus.Submitted && !selfIssueEmployeeIds.Contains(plan.EmployeeId)),
                    cyclePlans.Count(plan => plan.Status == PlanStatus.ChangesRequested),
                    cyclePlans.Count(plan => plan.Status == PlanStatus.Approved),
                    cyclePlans.Count(plan => selfIssueEmployeeIds.Contains(plan.EmployeeId)));
            })
            .ToList();

        return Result.Success<IReadOnlyList<PlanApprovalCampaignDto>>(campaigns);
    }
}
