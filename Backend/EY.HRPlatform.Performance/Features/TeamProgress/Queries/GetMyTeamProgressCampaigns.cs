using EY.HRPlatform.Performance.Domain.Enums;
using EY.HRPlatform.Performance.Features.Progress;
using EY.HRPlatform.Performance.Features.Security;
using EY.HRPlatform.Performance.Features.TeamProgress.Dtos;
using EY.HRPlatform.Performance.Infrastructure.Persistence;
using EY.HRPlatform.SharedKernel.CQRS;
using EY.HRPlatform.SharedKernel.Results;
using Microsoft.EntityFrameworkCore;

namespace EY.HRPlatform.Performance.Features.TeamProgress.Queries;

public sealed record GetMyTeamProgressCampaignsQuery() : IQuery<Result<IReadOnlyList<TeamProgressCampaignDto>>>;

/// <summary>
/// Lists the locked launched campaigns where the caller is the current effective reviewer of at
/// least one non-excluded participant with an approved plan. Empty result (not an error) when the
/// caller reviews nobody — the door hides rather than denies.
/// </summary>
public sealed class GetMyTeamProgressCampaignsQueryHandler(
    PerformanceDbContext dbContext,
    EffectiveReviewerResolver reviewerResolver,
    ICurrentUserContext currentUser) : IQueryHandler<GetMyTeamProgressCampaignsQuery, Result<IReadOnlyList<TeamProgressCampaignDto>>>
{
    public async Task<Result<IReadOnlyList<TeamProgressCampaignDto>>> Handle(
        GetMyTeamProgressCampaignsQuery request,
        CancellationToken cancellationToken)
    {
        var reviewerEmployeeId = currentUser.EmployeeId;
        if (!reviewerEmployeeId.HasValue)
            return Result.Success<IReadOnlyList<TeamProgressCampaignDto>>([]);

        var lockedCycles = await dbContext.PerformanceCycles
            .AsNoTracking()
            .Where(cycle => cycle.Status == PerformanceCycleStatus.Launched && cycle.PlanningLockedAt != null)
            .OrderByDescending(cycle => cycle.LaunchedAt)
            .ToListAsync(cancellationToken);

        var campaigns = new List<TeamProgressCampaignDto>();
        foreach (var cycle in lockedCycles)
        {
            var scope = await TeamProgressScope.BuildAsync(
                dbContext, reviewerResolver, cycle.Id, reviewerEmployeeId.Value, cancellationToken);
            if (scope.Participants.Count == 0)
                continue;

            var now = DateTime.UtcNow;
            var needsAttention = scope.Participants.Count(participant =>
                TeamProgressScope.NeedsAttention(participant, scope, cycle.PlanningLockedAt, now));

            campaigns.Add(new TeamProgressCampaignDto(
                cycle.Id,
                cycle.Slug,
                cycle.Name,
                cycle.ReferenceYear,
                cycle.LaunchedAt,
                cycle.PlanningLockedAt,
                scope.Participants.Count,
                needsAttention));
        }

        return Result.Success<IReadOnlyList<TeamProgressCampaignDto>>(campaigns);
    }
}
