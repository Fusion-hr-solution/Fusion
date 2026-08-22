using EY.HRPlatform.Performance.Domain.Cycles;
using EY.HRPlatform.Performance.Domain.Objectives;
using EY.HRPlatform.Performance.Infrastructure.Core;
using EY.HRPlatform.Performance.Infrastructure.Persistence;
using EY.HRPlatform.Performance.Models;
using EY.HRPlatform.SharedKernel.Results;
using Microsoft.EntityFrameworkCore;

namespace EY.HRPlatform.Performance.Features.Goals;

/// <summary>
/// Builds the Alignment/List overview and the objective context detail from the cycle's objective
/// graph, and holds the organizational-goal authorization helpers. The whole cycle graph is loaded
/// once (bounded per tenant) so the map, the list, and any detail read from consistent in-memory
/// state without an N+1 of per-node queries.
/// </summary>
public static class GoalsComposer
{
    public sealed class Graph
    {
        public required IReadOnlyList<Objective> All { get; init; }
        public required Dictionary<Guid, Objective> ById { get; init; }
        public required ILookup<Guid, Objective> ChildrenByParent { get; init; }
        public required Dictionary<Guid, string> Names { get; init; }
    }

    public static async Task<Graph> LoadGraphAsync(
        PerformanceDbContext db, ICoreWorkforceClient workforce, PerformanceCycle cycle, CancellationToken cancellationToken)
    {
        var objectives = await db.Objectives.AsNoTracking()
            .Where(o => o.CycleId == cycle.Id)
            .Include(o => o.Measurement)
            .Include(o => o.ContributionLinks)
            .Include(o => o.Decisions)
            .ToListAsync(cancellationToken);

        var personIds = objectives.Select(o => o.AccountablePersonId)
            .Concat(objectives.SelectMany(o => o.Decisions.Select(d => d.ActorEmployeeId)))
            .Where(id => id != Guid.Empty)
            .Distinct()
            .ToList();

        var names = new Dictionary<Guid, string>();
        if (personIds.Count > 0)
        {
            var snapshots = await workforce.ResolveAsync(cycle.StartDate.ToDateTime(TimeOnly.MinValue), personIds, cancellationToken);
            foreach (var snapshot in snapshots)
                names[snapshot.EmployeeId] = snapshot.DisplayName;
        }

        return new Graph
        {
            All = objectives,
            ById = objectives.ToDictionary(o => o.Id),
            // The org Alignment Map is strategic + organizational only; employee-plan objectives align
            // to direction but belong to My Plan, never the org map's child rails or child counts.
            ChildrenByParent = objectives
                .Where(o => o.ParentObjectiveId is not null && o.OwnershipScope != ObjectiveOwnershipScope.Employee)
                .ToLookup(o => o.ParentObjectiveId!.Value),
            Names = names,
        };
    }

    public static Result<GoalsOverviewDto> BuildOverview(PerformanceCycle cycle, Graph graph)
    {
        var nodes = graph.All
            .Where(o => o.OwnershipScope != ObjectiveOwnershipScope.Employee)
            .OrderBy(o => o.OwnershipScope)
            .ThenByDescending(o => o.State == ObjectiveLifecycleState.Approved || o.State == ObjectiveLifecycleState.Published)
            .ThenBy(o => o.Title)
            .Select(o => ToNode(o, graph))
            .ToList();

        var org = graph.All.Where(o => o.OwnershipScope == ObjectiveOwnershipScope.OrgUnit).ToList();
        return Result.Success(new GoalsOverviewDto(
            cycle.Id,
            cycle.Name,
            cycle.State,
            cycle.StartDate,
            cycle.EndDate,
            graph.All.Count(o => o.OwnershipScope == ObjectiveOwnershipScope.Company),
            org.Count,
            org.Count(o => o.State == ObjectiveLifecycleState.Submitted),
            org.Count(o => o.State == ObjectiveLifecycleState.Draft),
            nodes));
    }

    public static Result<GoalDetailDto> BuildDetail(Objective objective, Graph graph, GoalActorContext actor)
    {
        var parent = objective.ParentObjectiveId is not null ? graph.ById.GetValueOrDefault(objective.ParentObjectiveId.Value) : null;
        var children = graph.ChildrenByParent[objective.Id].OrderBy(o => o.Title).ToList();

        var contribution = objective.ContributionLinks
            .Select(link =>
            {
                var child = graph.ById.GetValueOrDefault(link.ChildObjectiveId);
                return new ContributionLinkDto(
                    link.ChildObjectiveId,
                    child?.Title ?? "Removed objective",
                    child?.State ?? ObjectiveLifecycleState.Draft,
                    link.Weight);
            })
            .ToList();

        var history = objective.Decisions
            .OrderBy(d => d.DecidedAt)
            .Select(d => new ObjectiveDecisionDto(d.Kind, d.ActorEmployeeId, graph.Names.GetValueOrDefault(d.ActorEmployeeId), d.Feedback, d.DecidedAt))
            .ToList();

        var canMaintain = CanMaintain(objective, actor);
        var canDecide = parent is not null
            && objective.OwnershipScope == ObjectiveOwnershipScope.OrgUnit
            && objective.State == ObjectiveLifecycleState.Submitted
            && parent.AccountablePersonId == actor.CallerEmployeeId;

        return Result.Success(new GoalDetailDto(
            ToNode(objective, graph),
            objective.Description,
            new PersonRefDto(objective.AccountablePersonId, graph.Names.GetValueOrDefault(objective.AccountablePersonId)),
            parent is null ? null : ToNode(parent, graph),
            children.Select(c => ToNode(c, graph)).ToList(),
            PerformanceMappers.ToDtoOrNull(objective.Measurement),
            contribution,
            history,
            CanEdit: canMaintain && objective.State == ObjectiveLifecycleState.Draft && objective.OwnershipScope == ObjectiveOwnershipScope.OrgUnit,
            CanSubmit: canMaintain && objective.State == ObjectiveLifecycleState.Draft && objective.OwnershipScope == ObjectiveOwnershipScope.OrgUnit,
            CanDecide: canDecide,
            CanConfigureContribution: canMaintain && objective.IsCalculated && !objective.IsContributionBaselineLocked));
    }

    public static GoalNodeDto ToNode(Objective objective, Graph graph)
    {
        var childCount = graph.ChildrenByParent[objective.Id].Count();

        decimal? contributionToParent = null;
        if (objective.ParentObjectiveId is not null
            && graph.ById.TryGetValue(objective.ParentObjectiveId.Value, out var parent))
        {
            var link = parent.ContributionLinks.FirstOrDefault(l => l.ChildObjectiveId == objective.Id);
            if (link is not null) contributionToParent = link.Weight;
        }

        return new GoalNodeDto(
            objective.Id,
            objective.OwnershipScope,
            objective.Title,
            objective.State,
            objective.ParentObjectiveId,
            objective.OrgUnitId,
            objective.OrgUnitName,
            objective.AccountablePersonId,
            graph.Names.GetValueOrDefault(objective.AccountablePersonId),
            objective.StartDate,
            objective.EndDate,
            objective.ProgressSource,
            PerformanceMappers.MeasurementSummary(objective),
            objective.IsAlignmentBaseline,
            objective.IsContributionBaselineLocked,
            objective.ContributionWeightTotal,
            childCount,
            objective.ContributionLinks.Count,
            contributionToParent);
    }

    // ── Authorization helpers ────────────────────────────────────────────────

    /// <summary>Maintenance (edit/submit/contribution) is the objective's own accountable person, or an admin.</summary>
    public static bool CanMaintain(Objective objective, GoalActorContext actor)
        => actor.IsAdmin || objective.AccountablePersonId == actor.CallerEmployeeId;

    /// <summary>
    /// Approve/return is the accountable person of the aligned parent objective ONLY — there is no
    /// tenant-admin override for organizational-objective approval (design Decision 4).
    /// </summary>
    public static async Task<bool> CanDecideAsync(PerformanceDbContext db, Objective objective, GoalActorContext actor, CancellationToken cancellationToken)
    {
        if (objective.ParentObjectiveId is null) return false;
        var parent = await db.Objectives.AsNoTracking().FirstOrDefaultAsync(o => o.Id == objective.ParentObjectiveId, cancellationToken);
        return parent is not null && parent.AccountablePersonId == actor.CallerEmployeeId;
    }

    /// <summary>Would aligning <paramref name="objectiveId"/> under <paramref name="newParentId"/> create a cycle?</summary>
    public static async Task<bool> CreatesCycleAsync(PerformanceDbContext db, Guid cycleId, Guid objectiveId, Guid newParentId, CancellationToken cancellationToken)
    {
        var links = await db.Objectives.AsNoTracking()
            .Where(o => o.CycleId == cycleId)
            .Select(o => new { o.Id, o.ParentObjectiveId })
            .ToListAsync(cancellationToken);
        var parentOf = links.ToDictionary(l => l.Id, l => l.ParentObjectiveId);

        var current = (Guid?)newParentId;
        var guard = 0;
        while (current is not null && guard++ < 1000)
        {
            if (current == objectiveId) return true;
            current = parentOf.GetValueOrDefault(current.Value);
        }
        return false;
    }

    /// <summary>
    /// A new contribution link or decision reached through an already-tracked objective carries a
    /// client-generated key, so EF detects it as Modified rather than Added; correct it so the row
    /// inserts. Mirrors the Population child-row fix.
    /// </summary>
    public static void FixNewChildRowState(PerformanceDbContext db)
    {
        foreach (var entry in db.ChangeTracker.Entries().Where(e => e.State == Microsoft.EntityFrameworkCore.EntityState.Modified))
        {
            if (entry.Entity is ContributionLink or ObjectiveDecision)
                entry.State = Microsoft.EntityFrameworkCore.EntityState.Added;
        }
    }
}
