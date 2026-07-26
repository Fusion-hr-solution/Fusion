using EY.HRPlatform.Performance.Domain.Entities;
using EY.HRPlatform.Performance.Domain.Enums;
using EY.HRPlatform.Performance.Features.Progress;
using EY.HRPlatform.Performance.Features.Progress.Dtos;
using EY.HRPlatform.Performance.Features.TeamProgress.Dtos;
using EY.HRPlatform.Performance.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace EY.HRPlatform.Performance.Features.TeamProgress;

/// <summary>
/// The reviewer-scoped slice of a locked campaign: the non-excluded participants with approved plans
/// for whom the caller is the current effective reviewer, plus the latest progress per objective.
/// This is the single gate that keeps a reviewer from seeing anyone they do not review.
/// </summary>
public sealed class TeamProgressScope
{
    private TeamProgressScope(
        IReadOnlyList<EmployeeObjectivePlan> plans,
        IReadOnlyDictionary<Guid, string> participantNames,
        IReadOnlyDictionary<Guid, LatestObjectiveProgress> latestByObjective)
    {
        Plans = plans;
        ParticipantNames = participantNames;
        LatestByObjective = latestByObjective;
    }

    public IReadOnlyList<EmployeeObjectivePlan> Plans { get; }
    public IReadOnlyDictionary<Guid, string> ParticipantNames { get; }
    public IReadOnlyDictionary<Guid, LatestObjectiveProgress> LatestByObjective { get; }

    /// <summary>Convenience alias — one plan per reviewed participant.</summary>
    public IReadOnlyList<EmployeeObjectivePlan> Participants => Plans;

    public static async Task<TeamProgressScope> BuildAsync(
        PerformanceDbContext dbContext,
        EffectiveReviewerResolver reviewerResolver,
        Guid cycleId,
        Guid reviewerEmployeeId,
        CancellationToken cancellationToken)
    {
        var effectiveByParticipant = await reviewerResolver.ResolveForCampaignAsync(cycleId, cancellationToken);
        var reviewedEmployeeIds = effectiveByParticipant
            .Where(pair => pair.Value == reviewerEmployeeId)
            .Select(pair => pair.Key)
            .ToHashSet();

        if (reviewedEmployeeIds.Count == 0)
            return new TeamProgressScope([], new Dictionary<Guid, string>(), new Dictionary<Guid, LatestObjectiveProgress>());

        var excludedEmployeeIds = await dbContext.PerformanceCycleParticipantExclusions
            .AsNoTracking()
            .Where(exclusion => exclusion.CycleId == cycleId)
            .Select(exclusion => exclusion.ParticipantEmployeeId)
            .ToListAsync(cancellationToken);
        reviewedEmployeeIds.ExceptWith(excludedEmployeeIds);

        if (reviewedEmployeeIds.Count == 0)
            return new TeamProgressScope([], new Dictionary<Guid, string>(), new Dictionary<Guid, LatestObjectiveProgress>());

        var plans = await dbContext.EmployeeObjectivePlans
            .AsNoTracking()
            .Include(plan => plan.Objectives)
            .Where(plan => plan.CycleId == cycleId
                           && plan.Status == PlanStatus.Approved
                           && reviewedEmployeeIds.Contains(plan.EmployeeId))
            .ToListAsync(cancellationToken);

        var names = await dbContext.PerformanceCycleParticipants
            .AsNoTracking()
            .Where(participant => participant.CycleId == cycleId && reviewedEmployeeIds.Contains(participant.EmployeeId))
            .Select(participant => new { participant.EmployeeId, participant.FullName })
            .ToDictionaryAsync(item => item.EmployeeId, item => item.FullName, cancellationToken);

        var latest = await ObjectiveProgressQueries.GetLatestByObjectiveAsync(
            dbContext, plans.Select(plan => plan.Id).ToList(), cancellationToken);

        return new TeamProgressScope(plans, names, latest);
    }

    /// <summary>Builds the attention-first participant summary for one reviewed plan.</summary>
    public TeamProgressParticipantDto ToParticipantDto(
        EmployeeObjectivePlan plan,
        DateTime? planningLockedAt,
        DateTime now)
    {
        var progress = ObjectiveProgressRules.BuildPlanProgress(plan.Objectives, LatestByObjective, planningLockedAt, now);
        var hasRecentRegression = HasRecentRegression(plan, now);
        var notStarted = progress.Objectives.Count(state => state.State == ObjectiveProgressRules.StateNotStarted);
        var lastActivityAt = plan.Objectives
            .Select(objective => LatestByObjective.TryGetValue(objective.Id, out var l) ? l.RecordedAt : (DateTime?)null)
            .Where(at => at.HasValue)
            .DefaultIfEmpty(null)
            .Max();

        var needsAttention = progress.StaleObjectiveCount > 0 || hasRecentRegression || notStarted > 0;

        return new TeamProgressParticipantDto(
            plan.EmployeeId,
            ParticipantNames.GetValueOrDefault(plan.EmployeeId, "Unknown"),
            progress.WeightedProgressPercent,
            progress.ObjectiveCount,
            progress.CompletedObjectiveCount,
            progress.StaleObjectiveCount,
            hasRecentRegression,
            notStarted,
            needsAttention,
            lastActivityAt,
            progress.Objectives);
    }

    public static bool NeedsAttention(
        EmployeeObjectivePlan plan,
        TeamProgressScope scope,
        DateTime? planningLockedAt,
        DateTime now)
        => scope.ToParticipantDto(plan, planningLockedAt, now).NeedsAttention;

    /// <summary>A regression is "recent" when an objective's latest update is a confirmed lower value inside the window.</summary>
    private bool HasRecentRegression(EmployeeObjectivePlan plan, DateTime now)
        => plan.Objectives.Any(objective =>
            LatestByObjective.TryGetValue(objective.Id, out var latest)
            && latest.IsLatestRegression
            && latest.RecordedAt >= now.AddDays(-ObjectiveProgressRules.StaleAfterDays));
}
