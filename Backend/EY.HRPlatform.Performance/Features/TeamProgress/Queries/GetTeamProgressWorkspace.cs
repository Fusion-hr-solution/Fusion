using EY.HRPlatform.Performance.Domain.Enums;
using EY.HRPlatform.Performance.Features.Progress;
using EY.HRPlatform.Performance.Features.Security;
using EY.HRPlatform.Performance.Features.TeamProgress.Dtos;
using EY.HRPlatform.Performance.Infrastructure.Persistence;
using EY.HRPlatform.SharedKernel.CQRS;
using EY.HRPlatform.SharedKernel.Results;
using Microsoft.EntityFrameworkCore;

namespace EY.HRPlatform.Performance.Features.TeamProgress.Queries;

public sealed record GetTeamProgressWorkspaceQuery(string Slug) : IQuery<Result<TeamProgressWorkspaceDto>>;

/// <summary>
/// Builds the attention-first team progress workspace for a locked campaign, scoped to the caller's
/// reviewed participants. Ordering: needs-attention first (stale / recent regression / not started),
/// then in-progress, completed calmest. Read-only — nothing here mutates state.
/// </summary>
public sealed class GetTeamProgressWorkspaceQueryHandler(
    PerformanceDbContext dbContext,
    EffectiveReviewerResolver reviewerResolver,
    ICurrentUserContext currentUser) : IQueryHandler<GetTeamProgressWorkspaceQuery, Result<TeamProgressWorkspaceDto>>
{
    public async Task<Result<TeamProgressWorkspaceDto>> Handle(
        GetTeamProgressWorkspaceQuery request,
        CancellationToken cancellationToken)
    {
        var reviewerEmployeeId = currentUser.EmployeeId;
        if (!reviewerEmployeeId.HasValue)
            return Result.Failure<TeamProgressWorkspaceDto>(Error.Forbidden(
                "TeamProgress.EmployeeContextForbidden",
                "Your account is not linked to an employee record."));

        var slug = (request.Slug ?? string.Empty).Trim().ToLowerInvariant();
        var cycle = await dbContext.PerformanceCycles
            .AsNoTracking()
            .FirstOrDefaultAsync(item => item.Slug == slug, cancellationToken);
        if (cycle is null)
            return Result.Failure<TeamProgressWorkspaceDto>(
                new Error("PerformanceCycle.NotFound", $"Campaign '{slug}' was not found."));

        if (cycle.Status != PerformanceCycleStatus.Launched || !cycle.IsPlanningLocked)
            return Result.Failure<TeamProgressWorkspaceDto>(Error.Validation(
                "TeamProgress.NotLockedInvalid",
                "Team progress opens once this campaign's planning is locked."));

        var scope = await TeamProgressScope.BuildAsync(
            dbContext, reviewerResolver, cycle.Id, reviewerEmployeeId.Value, cancellationToken);

        var now = DateTime.UtcNow;
        var participants = scope.Plans
            .Select(plan => scope.ToParticipantDto(plan, cycle.PlanningLockedAt, now))
            // Attention first, then by lowest weighted progress, then by name for stability.
            .OrderByDescending(participant => participant.NeedsAttention)
            .ThenByDescending(participant => participant.StaleObjectiveCount + (participant.HasRecentRegression ? 1 : 0) + participant.NotStartedObjectiveCount)
            .ThenBy(participant => participant.WeightedProgressPercent)
            .ThenBy(participant => participant.EmployeeName)
            .ToList();

        return Result.Success(new TeamProgressWorkspaceDto(
            cycle.Id,
            cycle.Slug,
            cycle.Name,
            cycle.ReferenceYear,
            cycle.LaunchedAt,
            cycle.PlanningLockedAt,
            ObjectiveProgressRules.StaleAfterDays,
            participants));
    }
}
