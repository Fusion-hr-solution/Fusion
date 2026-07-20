using EY.HRPlatform.Performance.Domain.Entities;
using EY.HRPlatform.Performance.Features.Progress.Dtos;
using EY.HRPlatform.Performance.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace EY.HRPlatform.Performance.Features.Progress;

/// <summary>
/// Derivation rules for objective progress. Current state is always computed from the append-only
/// history and the locked P1 baseline — nothing here is stored as an editable status.
/// </summary>
public static class ObjectiveProgressRules
{
    /// <summary>A non-completed objective with no update inside this window is stale (configuration UI deferred).</summary>
    public const int StaleAfterDays = 30;

    public const string AttachmentOwnerType = "ObjectiveProgressUpdate";

    public const string StateNotStarted = "not-started";
    public const string StateInProgress = "in-progress";
    public const string StateCompleted = "completed";

    public static string StateFor(int? latestPercent) => latestPercent switch
    {
        null => StateNotStarted,
        100 => StateCompleted,
        _ => StateInProgress,
    };

    /// <summary>
    /// Stale when not completed and the newest update — or the planning-lock time when the
    /// objective has none — is older than <see cref="StaleAfterDays"/>.
    /// </summary>
    public static bool IsStale(int? latestPercent, DateTime? lastUpdateAt, DateTime? planningLockedAt, DateTime now)
    {
        if (latestPercent == 100)
            return false;

        var reference = lastUpdateAt ?? planningLockedAt;
        return reference.HasValue && (now - reference.Value) > TimeSpan.FromDays(StaleAfterDays);
    }

    /// <summary>Σ(latest percent × locked weight) / 100 over the approved plan; objectives without updates contribute zero.</summary>
    public static int WeightedProgressPercent(IEnumerable<(int Weight, int Percent)> objectives)
    {
        var sum = objectives.Sum(item => (long)item.Weight * item.Percent);
        return (int)Math.Clamp(Math.Round(sum / 100.0, MidpointRounding.AwayFromZero), 0, 100);
    }

    /// <summary>Builds the derived plan progress DTO from the locked objectives and their latest updates.</summary>
    public static PlanProgressDto BuildPlanProgress(
        IReadOnlyCollection<EmployeeObjective> objectives,
        IReadOnlyDictionary<Guid, LatestObjectiveProgress> latestByObjective,
        DateTime? planningLockedAt,
        DateTime now)
    {
        var states = objectives
            .OrderBy(objective => objective.CreatedAt)
            .Select(objective =>
            {
                latestByObjective.TryGetValue(objective.Id, out var latest);
                return new ObjectiveProgressStateDto(
                    objective.Id,
                    latest?.Percent ?? 0,
                    StateFor(latest?.Percent),
                    IsStale(latest?.Percent, latest?.RecordedAt, planningLockedAt, now),
                    latest?.RecordedAt,
                    latest?.UpdateCount ?? 0,
                    latest?.ActualValue);
            })
            .ToList();

        var weighted = WeightedProgressPercent(objectives.Select(objective =>
        {
            latestByObjective.TryGetValue(objective.Id, out var latest);
            return (objective.Weight ?? 0, latest?.Percent ?? 0);
        }));

        return new PlanProgressDto(
            weighted,
            states.Count,
            states.Count(state => state.State == StateCompleted),
            states.Count(state => state.IsStale),
            StaleAfterDays,
            states);
    }
}

/// <summary>The latest recorded update for one objective plus its total update count.</summary>
public sealed record LatestObjectiveProgress(
    Guid ObjectiveId,
    int Percent,
    DateTime RecordedAt,
    string? ActualValue,
    int UpdateCount,
    bool IsLatestRegression);

public static class ObjectiveProgressQueries
{
    /// <summary>
    /// Latest update and count per objective for a set of plans. Uses an aggregate GroupBy (the
    /// newest timestamp and count per objective) then a targeted fetch of only the rows at that
    /// timestamp — so the full history never enters memory, and it translates on both Postgres and
    /// the in-memory test provider. Ties on the timestamp are broken by the greatest id.
    /// </summary>
    public static async Task<Dictionary<Guid, LatestObjectiveProgress>> GetLatestByObjectiveAsync(
        PerformanceDbContext dbContext,
        IReadOnlyCollection<Guid> planIds,
        CancellationToken cancellationToken)
    {
        if (planIds.Count == 0)
            return [];

        var aggregates = await dbContext.ObjectiveProgressUpdates
            .AsNoTracking()
            .Where(update => planIds.Contains(update.PlanId))
            .GroupBy(update => update.ObjectiveId)
            .Select(group => new
            {
                ObjectiveId = group.Key,
                MaxRecordedAt = group.Max(update => update.RecordedAt),
                Count = group.Count(),
            })
            .ToListAsync(cancellationToken);

        if (aggregates.Count == 0)
            return [];

        var maxTimestamps = aggregates.Select(item => item.MaxRecordedAt).Distinct().ToList();
        var countByObjective = aggregates.ToDictionary(item => item.ObjectiveId, item => item.Count);

        // Only the newest row(s) per objective — at most a handful — are materialized.
        var newestRows = await dbContext.ObjectiveProgressUpdates
            .AsNoTracking()
            .Where(update => planIds.Contains(update.PlanId) && maxTimestamps.Contains(update.RecordedAt))
            .Select(update => new
            {
                update.ObjectiveId,
                update.ProgressPercent,
                update.RecordedAt,
                update.ActualValue,
                update.IsRegression,
                update.Id,
            })
            .ToListAsync(cancellationToken);

        return newestRows
            .GroupBy(row => row.ObjectiveId)
            .Select(group => group
                .OrderByDescending(row => row.RecordedAt)
                .ThenByDescending(row => row.Id)
                .First())
            .ToDictionary(
                row => row.ObjectiveId,
                row => new LatestObjectiveProgress(
                    row.ObjectiveId,
                    row.ProgressPercent,
                    row.RecordedAt,
                    row.ActualValue,
                    countByObjective.GetValueOrDefault(row.ObjectiveId),
                    row.IsRegression));
    }
}
