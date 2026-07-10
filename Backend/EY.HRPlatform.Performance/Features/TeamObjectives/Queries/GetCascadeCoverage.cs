using EY.HRPlatform.Performance.Domain.Enums;
using EY.HRPlatform.Performance.Features.TeamObjectives.Dtos;
using EY.HRPlatform.Performance.Infrastructure.Persistence;
using EY.HRPlatform.SharedKernel.CQRS;
using EY.HRPlatform.SharedKernel.Results;
using Microsoft.EntityFrameworkCore;

namespace EY.HRPlatform.Performance.Features.TeamObjectives.Queries;

/// <summary>
/// The launched campaigns visible through the cascade coverage surface (the Direction door's
/// campaign list). Read-only, tenant-scoped by the global query filter.
/// </summary>
public sealed record GetCascadeCoverageCampaignsQuery() : IQuery<Result<IReadOnlyList<CascadeCoverageCampaignDto>>>;

public sealed class GetCascadeCoverageCampaignsQueryHandler(
    PerformanceDbContext dbContext) : IQueryHandler<GetCascadeCoverageCampaignsQuery, Result<IReadOnlyList<CascadeCoverageCampaignDto>>>
{
    public async Task<Result<IReadOnlyList<CascadeCoverageCampaignDto>>> Handle(
        GetCascadeCoverageCampaignsQuery request,
        CancellationToken cancellationToken)
    {
        var campaigns = await dbContext.PerformanceCycles
            .AsNoTracking()
            .Where(cycle => cycle.Status == PerformanceCycleStatus.Launched)
            .OrderByDescending(cycle => cycle.LaunchedAt)
            .Select(cycle => new CascadeCoverageCampaignDto(
                cycle.Id,
                cycle.Slug,
                cycle.Name,
                cycle.ReferenceYear,
                cycle.PlanningOpeningDate,
                cycle.LaunchedAt))
            .ToListAsync(cancellationToken);

        return Result.Success<IReadOnlyList<CascadeCoverageCampaignDto>>(campaigns);
    }
}

/// <summary>
/// The shared read-only cascade coverage view of a launched campaign: strategic objectives with
/// their team-objective counts, the frozen baseline's distinct approvers with scope sizes and
/// team-objective counts, and all team objectives. Computed live; reads never write and no
/// coverage state is persisted.
/// </summary>
public sealed record GetCascadeCoverageQuery(string Slug) : IQuery<Result<CascadeCoverageDto>>;

public sealed class GetCascadeCoverageQueryHandler(
    PerformanceDbContext dbContext) : IQueryHandler<GetCascadeCoverageQuery, Result<CascadeCoverageDto>>
{
    public async Task<Result<CascadeCoverageDto>> Handle(
        GetCascadeCoverageQuery request,
        CancellationToken cancellationToken)
    {
        var slug = (request.Slug ?? string.Empty).Trim().ToLowerInvariant();
        var cycle = await dbContext.PerformanceCycles
            .AsNoTracking()
            .Include(c => c.StrategicObjectives)
            .FirstOrDefaultAsync(c => c.Slug == slug, cancellationToken);

        if (cycle is null)
            return Result.Failure<CascadeCoverageDto>(
                new Error("PerformanceCycle.NotFound", $"Campaign '{slug}' was not found."));

        if (cycle.Status != PerformanceCycleStatus.Launched)
            return Result.Failure<CascadeCoverageDto>(Error.Validation(
                "CascadeCoverage.NotLaunchedInvalid",
                "This campaign is not launched for objective planning yet."));

        var teamObjectives = await dbContext.CampaignTeamObjectives
            .AsNoTracking()
            .Where(objective => objective.CycleId == cycle.Id)
            .OrderBy(objective => objective.CreatedAt)
            .ToListAsync(cancellationToken);

        var approverScopes = await dbContext.PerformanceCycleParticipants
            .AsNoTracking()
            .Where(participant => participant.CycleId == cycle.Id)
            .GroupBy(participant => new { participant.ApproverEmployeeId, participant.ApproverName })
            .Select(group => new
            {
                group.Key.ApproverEmployeeId,
                group.Key.ApproverName,
                ScopeSize = group.Count()
            })
            .ToListAsync(cancellationToken);

        var objectiveCountsByStrategic = teamObjectives
            .GroupBy(objective => objective.StrategicObjectiveId)
            .ToDictionary(group => group.Key, group => group.Count());

        var objectiveCountsByOwner = teamObjectives
            .GroupBy(objective => objective.OwnerManagerEmployeeId)
            .ToDictionary(group => group.Key, group => group.Count());

        var activeStrategicObjectives = cycle.StrategicObjectives
            .Where(objective => objective.IsActive)
            .OrderBy(objective => objective.CreatedAt)
            .Select(objective => new CoverageStrategicObjectiveDto(
                objective.Id,
                objective.Title,
                objective.Description,
                objective.ResponsibleFunctionLabel,
                objectiveCountsByStrategic.GetValueOrDefault(objective.Id)))
            .ToList();

        var managers = approverScopes
            .OrderBy(scope => scope.ApproverName)
            .Select(scope => new CoverageManagerDto(
                scope.ApproverEmployeeId,
                scope.ApproverName,
                scope.ScopeSize,
                objectiveCountsByOwner.GetValueOrDefault(scope.ApproverEmployeeId)))
            .ToList();

        var strategicTitles = cycle.StrategicObjectives.ToDictionary(o => o.Id, o => o.Title);

        var coverage = new CascadeCoverageDto(
            cycle.Id,
            cycle.Slug,
            cycle.Name,
            cycle.ReferenceYear,
            cycle.PlanningOpeningDate,
            cycle.EmployeeSubmissionDeadline,
            cycle.LaunchedAt,
            activeStrategicObjectives.Count,
            activeStrategicObjectives.Count(objective => objective.TeamObjectiveCount > 0),
            managers.Count,
            managers.Count(manager => manager.TeamObjectiveCount > 0),
            teamObjectives.Count,
            activeStrategicObjectives,
            managers,
            teamObjectives.Select(objective => TeamObjectiveMapper.ToDto(objective, strategicTitles)).ToList());

        return Result.Success(coverage);
    }
}
