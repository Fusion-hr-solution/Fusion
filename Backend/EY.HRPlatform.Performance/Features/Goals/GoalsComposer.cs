using EY.HRPlatform.Performance.Domain.Cycles;
using EY.HRPlatform.Performance.Domain.Objectives;
using EY.HRPlatform.Performance.Domain.Plans;
using EY.HRPlatform.Performance.Features.Progress;
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
            .ToListAsync(cancellationToken);

        var personIds = objectives.Select(o => o.AccountablePersonId)
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

    /// <summary>The plan an Employee objective belongs to (with its decision trail), or null for direction.</summary>
    public static Task<EmployeePlan?> LoadOwningPlanAsync(
        PerformanceDbContext db, Objective objective, CancellationToken cancellationToken)
        => objective.EmployeePlanId is Guid planId
            ? db.EmployeePlans.AsNoTracking()
                .Include(plan => plan.Decisions)
                .FirstOrDefaultAsync(plan => plan.Id == planId, cancellationToken)
            : Task.FromResult<EmployeePlan?>(null);

    /// <summary>
    /// The organization's direction graph as this viewer may see it: strategic and organizational
    /// objectives that connect up to company direction, filtered by <see cref="ObjectiveAccess.CanRead"/>
    /// so another team's Draft never leaves the server. Counts describe the filtered graph.
    /// </summary>
    public static Result<GoalsOverviewDto> BuildOverview(PerformanceCycle cycle, Graph graph, ObjectiveViewer viewer)
    {
        var visible = graph.All
            .Where(objective => objective.OwnershipScope != ObjectiveOwnershipScope.Employee
                && ConnectsToCompany(objective, graph)
                && ObjectiveAccess.CanRead(viewer, objective, plan: null))
            .ToList();
        var nodes = visible
            .OrderBy(o => o.OwnershipScope)
            .ThenByDescending(o => o.State == ObjectiveLifecycleState.Published)
            .ThenBy(o => o.Title)
            .Select(o => ToNode(o, graph))
            .ToList();

        var org = visible.Where(o => o.OwnershipScope == ObjectiveOwnershipScope.OrgUnit).ToList();
        return Result.Success(new GoalsOverviewDto(
            cycle.Id,
            cycle.Name,
            cycle.State,
            cycle.StartDate,
            cycle.EndDate,
            visible.Count(o => o.OwnershipScope == ObjectiveOwnershipScope.Company),
            org.Count,
            org.Count(o => o.State == ObjectiveLifecycleState.Published),
            org.Count(o => o.State == ObjectiveLifecycleState.Draft),
            nodes));
    }

    private static bool ConnectsToCompany(Objective objective, Graph graph)
    {
        var current = objective;
        var guard = new HashSet<Guid>();
        while (guard.Add(current.Id))
        {
            if (current.OwnershipScope == ObjectiveOwnershipScope.Company)
                return true;
            if (current.ParentObjectiveId is not Guid parentId
                || !graph.ById.TryGetValue(parentId, out current!))
                return false;
        }
        return false;
    }

    /// <summary>
    /// One objective's full record for this viewer. The caller has already established
    /// <see cref="ObjectiveAccess.CanRead"/> for <paramref name="objective"/>; its traversal (parent,
    /// children, contribution) is filtered by the same rule, and every capability comes from the same
    /// policy family. <paramref name="plan"/> is the owning plan of an Employee objective.
    /// </summary>
    public static Result<GoalDetailDto> BuildDetail(
        PerformanceCycle cycle,
        Objective objective,
        Graph graph,
        ObjectiveViewer viewer,
        EmployeePlan? plan = null)
    {
        var parent = objective.ParentObjectiveId is Guid parentId
            ? graph.ById.GetValueOrDefault(parentId)
            : null;
        if (parent is not null && !ObjectiveAccess.CanRead(viewer, parent, plan: null))
            parent = null;
        var children = graph.ChildrenByParent[objective.Id]
            .Where(child => ObjectiveAccess.CanRead(viewer, child, plan: null))
            .OrderBy(o => o.Title)
            .ToList();

        var open = !cycle.IsClosed;
        var isDraft = objective.State == ObjectiveLifecycleState.Draft;
        var isOrg = objective.OwnershipScope == ObjectiveOwnershipScope.OrgUnit;
        var canMaintain = open && ObjectiveAccess.CanMaintain(viewer, objective);
        var canConfigureContribution = canMaintain
            && objective.IsCalculated
            && !objective.IsContributionBaselineLocked;

        // Whoever configures an objective's contribution chose its contributors, so they see every linked
        // child; anyone else sees only the contributors they could read on their own.
        var contribution = objective.ContributionLinks
            .Select(link => (link, child: graph.ById.GetValueOrDefault(link.ChildObjectiveId)))
            .Where(pair => canConfigureContribution
                || (pair.child is not null && ObjectiveAccess.CanRead(viewer, pair.child, plan: null)))
            .Select(pair => new ContributionLinkDto(
                pair.link.ChildObjectiveId,
                pair.child?.Title ?? "Removed objective",
                pair.child?.State ?? ObjectiveLifecycleState.Draft,
                pair.link.Weight))
            .ToList();

        // Removal needs no aligned objective of any kind — plan objectives included — beneath it.
        var hasAnyChild = graph.All.Any(candidate => candidate.ParentObjectiveId == objective.Id);
        // A plan objective's owner is the plan's employee; the plan keeps their name from Cycle start.
        var ownerName = graph.Names.GetValueOrDefault(objective.AccountablePersonId)
            ?? (plan is not null && plan.EmployeeId == objective.AccountablePersonId && plan.EmployeeDisplayName.Length > 0
                ? plan.EmployeeDisplayName
                : null);

        return Result.Success(new GoalDetailDto(
            ToNode(objective, graph),
            objective.Description,
            new PersonRefDto(objective.AccountablePersonId, ownerName),
            parent is null ? null : ToNode(parent, graph),
            children.Select(c => ToNode(c, graph)).ToList(),
            PerformanceMappers.ToDtoOrNull(objective.Measurement),
            contribution,
            // Company direction is edited through Strategy; team objectives here. Both only as Drafts.
            CanEdit: canMaintain && isDraft,
            CanPublish: open && isDraft && ObjectiveAccess.CanGovern(viewer, objective),
            CanConfigureContribution: canConfigureContribution,
            CycleId: cycle.Id,
            Plan: objective.OwnershipScope == ObjectiveOwnershipScope.Employee && plan is not null
                ? new GoalPlanFacetDto(plan.Id, plan.State, objective.PlanWeight, new PersonRefDto(plan.EmployeeId, ownerName))
                : null,
            CanDelete: canMaintain && isDraft && (isOrg || objective.OwnershipScope == ObjectiveOwnershipScope.Company) && !hasAnyChild,
            CanUpdateProgress: open && ObjectiveAccess.CanUpdateProgress(viewer.Actor, objective, plan),
            CanReadProgressHistory: ObjectiveAccess.CanReadProgressHistory(viewer, objective, plan)));
    }

    public static GoalNodeDto ToNode(Objective objective, Graph graph)
    {
        var childCount = graph.ChildrenByParent[objective.Id].Count();
        var reported = ProgressCalc.For(objective, graph);

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
            contributionToParent,
            reported.HasProgress,
            reported.Progress,
            reported.Coverage,
            objective.PublishedAt,
            objective.CreatedAt,
            objective.UpdatedAt);
    }

    // ── Authorization helpers ────────────────────────────────────────────────

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
    /// A new contribution link reached through an already-tracked objective carries a client-generated
    /// key, so EF detects it as Modified rather than Added; correct it so the row inserts. Mirrors the
    /// Population child-row fix.
    /// </summary>
    public static void FixNewChildRowState(PerformanceDbContext db)
    {
        foreach (var entry in db.ChangeTracker.Entries().Where(e => e.State == Microsoft.EntityFrameworkCore.EntityState.Modified))
        {
            if (entry.Entity is ContributionLink)
                entry.State = Microsoft.EntityFrameworkCore.EntityState.Added;
        }
    }
}
