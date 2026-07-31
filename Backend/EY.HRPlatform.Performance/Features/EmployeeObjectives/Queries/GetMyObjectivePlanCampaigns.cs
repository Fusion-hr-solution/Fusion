using EY.HRPlatform.Performance.Domain.Enums;
using EY.HRPlatform.Performance.Features.EmployeeObjectives.Dtos;
using EY.HRPlatform.Performance.Features.Security;
using EY.HRPlatform.Performance.Infrastructure.Persistence;
using EY.HRPlatform.SharedKernel.CQRS;
using EY.HRPlatform.SharedKernel.Results;
using Microsoft.EntityFrameworkCore;

namespace EY.HRPlatform.Performance.Features.EmployeeObjectives.Queries;

public sealed record GetMyObjectivePlanCampaignsQuery() : IQuery<Result<IReadOnlyList<MyObjectivePlanCampaignDto>>>;

public sealed class GetMyObjectivePlanCampaignsQueryHandler(
    PerformanceDbContext dbContext,
    ICurrentUserContext currentUser) : IQueryHandler<GetMyObjectivePlanCampaignsQuery, Result<IReadOnlyList<MyObjectivePlanCampaignDto>>>
{
    public async Task<Result<IReadOnlyList<MyObjectivePlanCampaignDto>>> Handle(
        GetMyObjectivePlanCampaignsQuery request,
        CancellationToken cancellationToken)
    {
        var employeeId = currentUser.EmployeeId;
        if (!employeeId.HasValue)
            return Result.Success<IReadOnlyList<MyObjectivePlanCampaignDto>>([]);

        var participantCycleIds = await dbContext.PerformanceCycleParticipants
            .AsNoTracking()
            .Where(participant => participant.EmployeeId == employeeId.Value)
            .Select(participant => participant.CycleId)
            .ToListAsync(cancellationToken);

        if (participantCycleIds.Count == 0)
            return Result.Success<IReadOnlyList<MyObjectivePlanCampaignDto>>([]);

        var plans = await dbContext.EmployeeObjectivePlans
            .AsNoTracking()
            .Where(plan => plan.EmployeeId == employeeId.Value && participantCycleIds.Contains(plan.CycleId))
            .Select(plan => new
            {
                plan.CycleId,
                plan.Status,
                Count = plan.Objectives.Count,
                Total = plan.Objectives.Sum(objective => objective.Weight ?? 0)
            })
            .ToDictionaryAsync(plan => plan.CycleId, cancellationToken);

        var campaigns = await dbContext.PerformanceCycles
            .AsNoTracking()
            .Where(cycle => participantCycleIds.Contains(cycle.Id) && cycle.Status == PerformanceCycleStatus.Launched)
            .OrderByDescending(cycle => cycle.LaunchedAt)
            .Select(cycle => new
            {
                cycle.Id,
                cycle.Slug,
                cycle.Name,
                cycle.ReferenceYear,
                cycle.PlanningOpeningDate,
                cycle.EmployeeSubmissionDeadline,
                cycle.ManagerApprovalDeadline,
                cycle.LaunchedAt
            })
            .ToListAsync(cancellationToken);

        return Result.Success<IReadOnlyList<MyObjectivePlanCampaignDto>>(campaigns
            .Select(campaign =>
            {
                plans.TryGetValue(campaign.Id, out var plan);
                return new MyObjectivePlanCampaignDto(
                    campaign.Id,
                    campaign.Slug,
                    campaign.Name,
                    campaign.ReferenceYear,
                    campaign.PlanningOpeningDate,
                    campaign.EmployeeSubmissionDeadline,
                    campaign.ManagerApprovalDeadline,
                    campaign.LaunchedAt,
                    plan?.Status,
                    plan?.Count ?? 0,
                    plan?.Total ?? 0);
            })
            .ToList());
    }
}
