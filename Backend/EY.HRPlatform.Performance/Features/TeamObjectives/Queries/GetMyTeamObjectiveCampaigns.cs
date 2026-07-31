using EY.HRPlatform.Performance.Domain.Enums;
using EY.HRPlatform.Performance.Features.Security;
using EY.HRPlatform.Performance.Features.TeamObjectives.Dtos;
using EY.HRPlatform.Performance.Infrastructure.Persistence;
using EY.HRPlatform.SharedKernel.CQRS;
using EY.HRPlatform.SharedKernel.Results;
using Microsoft.EntityFrameworkCore;

namespace EY.HRPlatform.Performance.Features.TeamObjectives.Queries;

/// <summary>
/// The launched campaigns where the signed-in user is the frozen approver of at least one
/// participant. Scope derives solely from the frozen P1.2 baseline — never from live Core
/// reporting lines. A user without a linked employee identity has no scope and gets an
/// empty list, not an error.
/// </summary>
public sealed record GetMyTeamObjectiveCampaignsQuery() : IQuery<Result<IReadOnlyList<MyTeamObjectiveCampaignDto>>>;

public sealed class GetMyTeamObjectiveCampaignsQueryHandler(
    PerformanceDbContext dbContext,
    ICurrentUserContext currentUser) : IQueryHandler<GetMyTeamObjectiveCampaignsQuery, Result<IReadOnlyList<MyTeamObjectiveCampaignDto>>>
{
    public async Task<Result<IReadOnlyList<MyTeamObjectiveCampaignDto>>> Handle(
        GetMyTeamObjectiveCampaignsQuery request,
        CancellationToken cancellationToken)
    {
        var employeeId = currentUser.EmployeeId;
        if (!employeeId.HasValue)
            return Result.Success<IReadOnlyList<MyTeamObjectiveCampaignDto>>([]);

        var scopeCounts = await dbContext.PerformanceCycleParticipants
            .AsNoTracking()
            .Where(participant => participant.ApproverEmployeeId == employeeId.Value)
            .GroupBy(participant => participant.CycleId)
            .Select(group => new { CycleId = group.Key, Count = group.Count() })
            .ToListAsync(cancellationToken);

        if (scopeCounts.Count == 0)
            return Result.Success<IReadOnlyList<MyTeamObjectiveCampaignDto>>([]);

        var cycleIds = scopeCounts.Select(scope => scope.CycleId).ToList();

        var cycles = await dbContext.PerformanceCycles
            .AsNoTracking()
            .Where(cycle => cycleIds.Contains(cycle.Id) && cycle.Status == PerformanceCycleStatus.Launched)
            .ToListAsync(cancellationToken);

        var myObjectiveCounts = await dbContext.CampaignTeamObjectives
            .AsNoTracking()
            .Where(objective => objective.OwnerManagerEmployeeId == employeeId.Value && cycleIds.Contains(objective.CycleId))
            .GroupBy(objective => objective.CycleId)
            .Select(group => new { CycleId = group.Key, Count = group.Count() })
            .ToDictionaryAsync(group => group.CycleId, group => group.Count, cancellationToken);

        var campaigns = cycles
            .OrderByDescending(cycle => cycle.LaunchedAt)
            .Select(cycle => new MyTeamObjectiveCampaignDto(
                cycle.Id,
                cycle.Slug,
                cycle.Name,
                cycle.ReferenceYear,
                cycle.PlanningOpeningDate,
                cycle.EmployeeSubmissionDeadline,
                cycle.ManagerApprovalDeadline,
                cycle.LaunchedAt,
                scopeCounts.First(scope => scope.CycleId == cycle.Id).Count,
                myObjectiveCounts.GetValueOrDefault(cycle.Id)))
            .ToList();

        return Result.Success<IReadOnlyList<MyTeamObjectiveCampaignDto>>(campaigns);
    }
}
