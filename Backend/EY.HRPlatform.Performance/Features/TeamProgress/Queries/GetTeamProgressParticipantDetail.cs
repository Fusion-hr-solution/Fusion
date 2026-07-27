using EY.HRPlatform.Performance.Domain.Enums;
using EY.HRPlatform.Performance.Features.EmployeeObjectives;
using EY.HRPlatform.Performance.Features.Progress;
using EY.HRPlatform.Performance.Features.Progress.Queries;
using EY.HRPlatform.Performance.Features.Security;
using EY.HRPlatform.Performance.Features.TeamProgress.Dtos;
using EY.HRPlatform.Performance.Infrastructure.Persistence;
using EY.HRPlatform.SharedKernel.CQRS;
using EY.HRPlatform.SharedKernel.Results;
using Microsoft.EntityFrameworkCore;

namespace EY.HRPlatform.Performance.Features.TeamProgress.Queries;

public sealed record GetTeamProgressParticipantDetailQuery(string Slug, Guid EmployeeId)
    : IQuery<Result<TeamProgressParticipantDetailDto>>;

/// <summary>
/// Read-only drill-in for one reviewed participant: locked objectives, derived state, and the full
/// append-only progress history with evidence. Denies when the caller is not the participant's
/// current effective reviewer — holding the permission alone is never enough.
/// </summary>
public sealed class GetTeamProgressParticipantDetailQueryHandler(
    PerformanceDbContext dbContext,
    EffectiveReviewerResolver reviewerResolver,
    ObjectiveProgressHistoryReader historyReader,
    ICurrentUserContext currentUser) : IQueryHandler<GetTeamProgressParticipantDetailQuery, Result<TeamProgressParticipantDetailDto>>
{
    public async Task<Result<TeamProgressParticipantDetailDto>> Handle(
        GetTeamProgressParticipantDetailQuery request,
        CancellationToken cancellationToken)
    {
        var reviewerEmployeeId = currentUser.EmployeeId;
        if (!reviewerEmployeeId.HasValue)
            return Result.Failure<TeamProgressParticipantDetailDto>(Error.Forbidden(
                "TeamProgress.EmployeeContextForbidden",
                "Your account is not linked to an employee record."));

        var slug = (request.Slug ?? string.Empty).Trim().ToLowerInvariant();
        var cycle = await dbContext.PerformanceCycles
            .AsNoTracking()
            .FirstOrDefaultAsync(item => item.Slug == slug, cancellationToken);
        if (cycle is null)
            return Result.Failure<TeamProgressParticipantDetailDto>(
                new Error("PerformanceCycle.NotFound", $"Campaign '{slug}' was not found."));

        // A closed campaign is read-only, not unreadable: every read still answers with the
        // state as it stood at closure.
        if (!cycle.IsOpenOrClosed() || !cycle.IsPlanningLocked)
            return Result.Failure<TeamProgressParticipantDetailDto>(Error.Validation(
                "TeamProgress.NotLockedInvalid",
                "Team progress opens once this campaign's planning is locked."));

        var scope = await TeamProgressScope.BuildAsync(
            dbContext, reviewerResolver, cycle.Id, reviewerEmployeeId.Value, cancellationToken);
        var plan = scope.Plans.FirstOrDefault(item => item.EmployeeId == request.EmployeeId);
        if (plan is null)
            return Result.Failure<TeamProgressParticipantDetailDto>(Error.Forbidden(
                "TeamProgress.NotReviewerForbidden",
                "You do not review this participant in this campaign."));

        var now = DateTime.UtcNow;
        var progress = ObjectiveProgressRules.BuildPlanProgress(
            plan.Objectives, scope.LatestByObjective, cycle.PlanningLockedAt, now);
        var stateByObjective = progress.Objectives.ToDictionary(state => state.ObjectiveId);

        var historyByObjective = await historyReader.GetHistoryByObjectiveAsync([plan.Id], cancellationToken);

        var objectives = plan.Objectives
            .OrderBy(objective => objective.CreatedAt)
            .Select(objective => new TeamProgressObjectiveDetailDto(
                EmployeeObjectivePlanMapper.ToObjectiveDto(objective),
                stateByObjective[objective.Id],
                historyByObjective.GetValueOrDefault(objective.Id, [])))
            .ToList();

        return Result.Success(new TeamProgressParticipantDetailDto(
            cycle.Id,
            cycle.Slug,
            cycle.Name,
            plan.EmployeeId,
            scope.ParticipantNames.GetValueOrDefault(plan.EmployeeId, "Unknown"),
            progress,
            objectives));
    }
}
