using EY.HRPlatform.Performance.Domain.Objectives;
using EY.HRPlatform.Performance.Features.Goals;

namespace EY.HRPlatform.Performance.Features.Progress;

/// <summary>
/// The truthful progress and coverage math over the objective graph (product-spec §21/§27). A direct
/// objective reports its own derived progress; a calculated parent rolls up only its configured
/// contributors as <c>Σ min(childReported, 100%) × weight</c>, and a contributor that never reported
/// contributes no known achievement while its weight counts against coverage — never silently
/// excluded, renormalized, or shown as achieved 0%. Alignment is never treated as contribution.
/// </summary>
public static class ProgressCalc
{
    public readonly record struct Reported(bool HasProgress, decimal Progress, decimal? Coverage);

    /// <summary>Computes an objective's reported progress and, for a calculated parent, its coverage.</summary>
    public static Reported For(Objective objective, GoalsComposer.Graph graph)
        => For(objective, graph, new HashSet<Guid>());

    private static Reported For(Objective objective, GoalsComposer.Graph graph, HashSet<Guid> guard)
    {
        if (!guard.Add(objective.Id))
            return new Reported(false, 0m, null);

        if (objective.ProgressSource == ObjectiveProgressSource.Direct)
            return new Reported(objective.HasProgress, objective.DerivedProgress, null);

        // Calculated: roll up configured contributors only.
        decimal progress = 0m;
        decimal coverage = 0m;
        foreach (var link in objective.ContributionLinks)
        {
            if (!graph.ById.TryGetValue(link.ChildObjectiveId, out var child)) continue;
            var childReported = For(child, graph, guard);
            var capped = Math.Min(childReported.Progress, 100m);
            progress += capped * link.Weight / 100m;
            if (childReported.HasProgress) coverage += link.Weight;
        }

        return new Reported(coverage > 0m, decimal.Round(progress, 2), decimal.Round(coverage, 2));
    }

    /// <summary>Plan progress: the weighted sum of the plan objectives' progress, each capped at 100%.</summary>
    public static decimal PlanProgress(IEnumerable<Objective> planObjectives)
    {
        decimal total = 0m;
        foreach (var objective in planObjectives)
        {
            var progress = objective.HasProgress ? Math.Min(objective.DerivedProgress, 100m) : 0m;
            total += progress * (objective.PlanWeight ?? 0m) / 100m;
        }
        return decimal.Round(total, 2);
    }
}
