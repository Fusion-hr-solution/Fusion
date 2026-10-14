using EY.HRPlatform.Performance.Domain.Objectives;

namespace EY.HRPlatform.Performance.Features.Progress;

/// <summary>
/// The execution facts every projection reports (design §18). They are facts, never a health rating:
/// an objective is overdue when it is incomplete and either its end date or one of its incomplete
/// milestones' due dates has passed — counted once per objective however many milestones slipped; it
/// lacks a recent update when 30 days of execution have gone by without a progress update.
/// </summary>
public static class ExecutionFacts
{
    /// <summary>A product constant, not a tenant setting.</summary>
    public const int RecentUpdateDays = 30;

    /// <param name="progress">The objective's reported progress; defaults to its own derived progress.</param>
    public static bool IsOverdue(Objective objective, DateOnly today, decimal? progress = null)
    {
        if ((progress ?? objective.DerivedProgress) >= 100m) return false;
        if (objective.EndDate < today) return true;
        return (objective.Measurement?.Milestones ?? [])
            .Any(m => !m.IsCompleted && m.DueDate is { } due && due < today);
    }

    public static int OverdueObjectiveCount(IEnumerable<Objective> objectives, DateOnly today)
        => objectives.Count(o => IsOverdue(o, today));

    /// <summary>
    /// Whether an executing objective has gone <see cref="RecentUpdateDays"/> days without an update. Before
    /// the first update, the clock runs from when execution began (the plan's approval), so a plan approved
    /// last week does not already read as stale.
    /// </summary>
    public static bool LacksRecentUpdate(Objective objective, DateTime executionStartedAt, DateTime now)
    {
        var last = objective.LastProgressAt ?? executionStartedAt;
        return now - last > TimeSpan.FromDays(RecentUpdateDays);
    }
}
