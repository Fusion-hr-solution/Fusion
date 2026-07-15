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

        var reassignedHistory = await dbContext.PerformanceCycleApproverReassignments
            .AsNoTracking()
            .Where(item => item.NewApproverEmployeeId == employeeId.Value)
            .ToListAsync(cancellationToken);
        var reassignedParticipantKeys = reassignedHistory
            .GroupBy(item => new { item.CycleId, item.ParticipantEmployeeId })
            .Select(group => group.OrderByDescending(item => item.ReassignedAt).First())
            .Select(item => new { item.CycleId, EmployeeId = item.ParticipantEmployeeId })
            .ToList();

        var reassignedCycleIds = reassignedParticipantKeys.Select(item => item.CycleId).Distinct().ToList();
        if (reassignedCycleIds.Count > 0)
        {
            var reassignedParticipants = await dbContext.PerformanceCycleParticipants
                .AsNoTracking()
                .Where(item => reassignedCycleIds.Contains(item.CycleId))
                .ToListAsync(cancellationToken);
            var reassignedSet = reassignedParticipantKeys.ToHashSet();
            participants.AddRange(reassignedParticipants.Where(item =>
                reassignedSet.Contains(new { item.CycleId, item.EmployeeId })));
        }

        participants = participants
            .GroupBy(item => new { item.CycleId, item.EmployeeId })
            .Select(group => group.First())
            .ToList();

        if (participants.Count == 0)
            return Result.Success<IReadOnlyList<PlanApprovalCampaignDto>>([]);

        var cycleIds = participants.Select(participant => participant.CycleId).Distinct().ToList();
        var cycles = await dbContext.PerformanceCycles
            .AsNoTracking()
            .Where(cycle => cycleIds.Contains(cycle.Id) && cycle.Status == PerformanceCycleStatus.Launched)
            .ToListAsync(cancellationToken);

        var launchedCycleIds = cycles.Select(cycle => cycle.Id).ToHashSet();
        var reassignments = await dbContext.PerformanceCycleApproverReassignments
            .AsNoTracking()
            .Where(item => launchedCycleIds.Contains(item.CycleId))
            .OrderBy(item => item.ReassignedAt)
            .ToListAsync(cancellationToken);
        var reassignmentByParticipant = reassignments
            .GroupBy(item => new { item.CycleId, item.ParticipantEmployeeId })
            .ToDictionary(group => group.Key, group => group.Last());

        var participantKeys = participants
            .Where(participant => launchedCycleIds.Contains(participant.CycleId))
            .Where(participant =>
            {
                var key = new { participant.CycleId, ParticipantEmployeeId = participant.EmployeeId };
                var effectiveApprover = reassignmentByParticipant.TryGetValue(key, out var reassignment)
                    ? reassignment.NewApproverEmployeeId
                    : participant.ApproverEmployeeId;
                return effectiveApprover == employeeId.Value;
            })
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
                    cycle.PlanningLockedAt,
                    cycle.PlanningLockedByName,
                    cyclePlans.Count(plan => plan.Status == PlanStatus.Submitted && !selfIssueEmployeeIds.Contains(plan.EmployeeId)),
                    cyclePlans.Count(plan => plan.Status == PlanStatus.ChangesRequested),
                    cyclePlans.Count(plan => plan.Status == PlanStatus.Approved),
                    cyclePlans.Count(plan => selfIssueEmployeeIds.Contains(plan.EmployeeId)));
            })
            .ToList();

        return Result.Success<IReadOnlyList<PlanApprovalCampaignDto>>(campaigns);
    }
}
