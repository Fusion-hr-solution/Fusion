using EY.HRPlatform.Performance.Domain.Cycles;
using EY.HRPlatform.Performance.Domain.Objectives;
using EY.HRPlatform.Performance.Domain.Plans;
using EY.HRPlatform.Performance.Features.Goals;
using EY.HRPlatform.Performance.Features.Progress;
using EY.HRPlatform.Performance.Infrastructure.Core;
using EY.HRPlatform.Performance.Infrastructure.Persistence;
using EY.HRPlatform.Performance.Models;
using Microsoft.EntityFrameworkCore;

namespace EY.HRPlatform.Performance.Features.Plans;

/// <summary>
/// The caller's contextual authorization inputs for plan actions, resolved once by the controller
/// from the token. Self-identity gates authoring; the responsible-manager relationship gates review
/// and approval; tenant administration gates the governed exceptional approval (design Decision 2).
/// </summary>
public sealed record PlanActorContext(Guid CallerEmployeeId, bool IsAdmin, bool CanReviewReports);

/// <summary>
/// Builds the employee-plan surfaces from the cycle's objective graph and the plan aggregate, and
/// holds the plan authorization + submission-fact helpers. The objective graph is loaded once so the
/// plan objectives, their upstream direction paths, and the alignable targets read from consistent
/// in-memory state. Alignment (a support relationship up to strategic direction) is resolved from the
/// objective graph; the plan aggregate owns only lifecycle, weights invariant, and the agreement trail.
/// </summary>
public static class PlansComposer
{
    public static async Task<EmployeePlanDto> BuildPlanAsync(
        PerformanceDbContext db,
        ICoreWorkforceClient workforce,
        PerformanceCycle cycle,
        EmployeePlan plan,
        bool standaloneAllowed,
        PlanActorContext actor,
        CancellationToken cancellationToken)
    {
        var graph = await GoalsComposer.LoadGraphAsync(db, workforce, cycle, cancellationToken);
        return BuildPlan(cycle, plan, graph, standaloneAllowed, actor);
    }

    public static EmployeePlanDto BuildPlan(
        PerformanceCycle cycle,
        EmployeePlan plan,
        GoalsComposer.Graph graph,
        bool standaloneAllowed,
        PlanActorContext actor)
    {
        var planObjectiveEntities = graph.All.Where(o => o.EmployeePlanId == plan.Id).ToList();
        var isSelf0 = plan.EmployeeId == actor.CallerEmployeeId;
        var canUpdateProgress = plan.State == PlanLifecycleState.Approved && isSelf0 && !cycle.IsClosed;

        var objectives = planObjectiveEntities
            .OrderBy(o => o.IsAligned ? 0 : 1)
            .ThenBy(o => o.Title)
            .Select(o => ToPlanObjective(o, graph, canUpdateProgress))
            .ToList();

        var planProgress = ProgressCalc.PlanProgress(planObjectiveEntities);

        var readiness = BuildReadiness(plan, graph, standaloneAllowed);

        var history = plan.Decisions
            .OrderBy(d => d.DecidedAt)
            .Select(d => new PlanDecisionDto(d.Kind, d.ActorEmployeeId, graph.Names.GetValueOrDefault(d.ActorEmployeeId), d.Feedback, d.DecidedAt))
            .ToList();

        var isSelf = plan.EmployeeId == actor.CallerEmployeeId;
        var cycleOpen = !cycle.IsClosed;
        var canAuthor = isSelf && plan.State == PlanLifecycleState.Draft && cycleOpen;
        var canDecide = plan.State == PlanLifecycleState.Submitted
            && cycleOpen
            && actor.CanReviewReports
            && plan.ResponsibleManagerId is not null
            && plan.ResponsibleManagerId == actor.CallerEmployeeId;
        var canApproveExceptionally = plan.State == PlanLifecycleState.Submitted && cycleOpen && actor.IsAdmin;

        return new EmployeePlanDto(
            plan.Id,
            cycle.Id,
            cycle.Name,
            cycle.State,
            new PersonRefDto(plan.EmployeeId, plan.EmployeeDisplayName),
            plan.OrgUnitName,
            plan.ResponsibleManagerId is null ? null : new PersonRefDto(plan.ResponsibleManagerId.Value, plan.ResponsibleManagerName),
            plan.State,
            plan.SubmittedAt,
            plan.ApprovedAt,
            plan.ApprovalKind,
            plan.IsLocked,
            planProgress,
            objectives,
            readiness,
            history,
            CanAuthor: canAuthor,
            CanSubmit: canAuthor && readiness.CanSubmit,
            CanDecide: canDecide,
            CanApproveExceptionally: canApproveExceptionally);
    }

    public static PlanReadinessDto BuildReadiness(EmployeePlan plan, GoalsComposer.Graph graph, bool standaloneAllowed)
    {
        var facts = FactsFor(plan, graph, standaloneAllowed);
        var remaining = 100m - facts.WeightTotal;

        var blockers = new List<string>();
        if (facts.ObjectiveCount == 0) blockers.Add("Add at least one objective.");
        if (facts.ObjectiveCount > 0 && !facts.EveryObjectiveHasWeight) blockers.Add("Give every objective a weight.");
        if (facts.ObjectiveCount > 0 && facts.WeightTotal != 100m)
            blockers.Add(remaining > 0 ? $"Assign {Trim(remaining)}% more." : $"Reduce weights by {Trim(-remaining)}%.");
        if (facts.ObjectiveCount > 0 && !facts.ConnectsToStrategicDirection)
            blockers.Add("Align at least one objective to strategic direction.");
        if (facts.HasStandaloneObjective && !facts.StandaloneAllowed)
            blockers.Add("Standalone objectives are not permitted; align every objective.");

        return new PlanReadinessDto(
            facts.ObjectiveCount,
            facts.WeightTotal,
            remaining,
            facts.EveryObjectiveHasWeight,
            facts.ConnectsToStrategicDirection,
            facts.HasStandaloneObjective,
            facts.StandaloneAllowed,
            CanSubmit: blockers.Count == 0 && facts.ObjectiveCount > 0,
            blockers);
    }

    /// <summary>The whole-plan submission facts drawn from the plan's objective rows in the graph.</summary>
    public static PlanSubmissionFacts FactsFor(EmployeePlan plan, GoalsComposer.Graph graph, bool standaloneAllowed)
    {
        var objectives = graph.All.Where(o => o.EmployeePlanId == plan.Id).ToList();
        var weightTotal = objectives.Sum(o => o.PlanWeight ?? 0m);
        return new PlanSubmissionFacts(
            ObjectiveCount: objectives.Count,
            EveryObjectiveHasWeight: objectives.Count > 0 && objectives.All(o => o.PlanWeight is > 0m),
            WeightTotal: weightTotal,
            ConnectsToStrategicDirection: objectives.Any(o => ConnectsToStrategic(o, graph)),
            HasStandaloneObjective: objectives.Any(o => !o.IsAligned),
            StandaloneAllowed: standaloneAllowed);
    }

    /// <summary>Published strategic and published organizational objectives an employee objective may align to.</summary>
    public static IReadOnlyList<AlignmentTargetDto> AlignmentTargets(GoalsComposer.Graph graph)
        => graph.All
            .Where(o => (o.OwnershipScope == ObjectiveOwnershipScope.Company || o.OwnershipScope == ObjectiveOwnershipScope.OrgUnit)
                && o.State == ObjectiveLifecycleState.Published)
            .OrderBy(o => o.OwnershipScope)
            .ThenBy(o => o.Title)
            .Select(o => new AlignmentTargetDto(
                o.Id,
                o.OwnershipScope,
                o.Title,
                o.OrgUnitName,
                o.AccountablePersonId,
                graph.Names.GetValueOrDefault(o.AccountablePersonId),
                o.StartDate,
                o.EndDate,
                DirectionPathTo(o, graph)))
            .ToList();

    public static PlanReviewSummaryDto ToReviewSummary(EmployeePlan plan, GoalsComposer.Graph graph)
    {
        var objectives = graph.All.Where(o => o.EmployeePlanId == plan.Id).ToList();
        return new PlanReviewSummaryDto(
            plan.Id,
            new PersonRefDto(plan.EmployeeId, plan.EmployeeDisplayName),
            plan.OrgUnitName,
            plan.State,
            objectives.Count,
            objectives.Sum(o => o.PlanWeight ?? 0m),
            objectives.Count(o => o.IsAligned),
            objectives.Count(o => !o.IsAligned),
            plan.SubmittedAt);
    }

    // ── Authorization helpers ────────────────────────────────────────────────

    /// <summary>Authoring is the plan's own employee while the plan is Draft.</summary>
    public static bool CanAuthor(EmployeePlan plan, PlanActorContext actor)
        => plan.EmployeeId == actor.CallerEmployeeId && plan.State == PlanLifecycleState.Draft;

    /// <summary>Review/approve is the responsible manager with the reports-view capability — no admin override on the normal path.</summary>
    public static bool CanDecide(EmployeePlan plan, PlanActorContext actor)
        => actor.CanReviewReports
            && plan.ResponsibleManagerId is not null
            && plan.ResponsibleManagerId == actor.CallerEmployeeId;

    // ── Internals ────────────────────────────────────────────────────────────

    private static PlanObjectiveDto ToPlanObjective(Objective objective, GoalsComposer.Graph graph, bool canUpdateProgress)
        => new(
            objective.Id,
            objective.Title,
            objective.Description,
            objective.ParentObjectiveId,
            DirectionPathTo(objective, graph, includeSelf: false),
            objective.IsAligned,
            objective.StartDate,
            objective.EndDate,
            objective.ProgressSource,
            PerformanceMappers.MeasurementSummary(objective),
            PerformanceMappers.ToDtoOrNull(objective.Measurement),
            objective.PlanWeight,
            objective.HasProgress,
            decimal.Round(objective.DerivedProgress, 2),
            canUpdateProgress);

    private static bool ConnectsToStrategic(Objective objective, GoalsComposer.Graph graph)
    {
        var current = objective.ParentObjectiveId;
        var guard = 0;
        while (current is not null && guard++ < 100)
        {
            if (!graph.ById.TryGetValue(current.Value, out var ancestor)) return false;
            if (ancestor.OwnershipScope == ObjectiveOwnershipScope.Company) return true;
            current = ancestor.ParentObjectiveId;
        }
        return false;
    }

    /// <summary>Readable direction labels from the top strategic objective down to the objective's parent (or itself).</summary>
    private static IReadOnlyList<string> DirectionPathTo(Objective objective, GoalsComposer.Graph graph, bool includeSelf = true)
    {
        var chain = new List<string>();
        var current = includeSelf ? (Guid?)objective.Id : objective.ParentObjectiveId;
        var guard = 0;
        while (current is not null && guard++ < 100)
        {
            if (!graph.ById.TryGetValue(current.Value, out var node)) break;
            chain.Add(node.Title);
            current = node.ParentObjectiveId;
        }
        chain.Reverse();
        return chain;
    }

    private static string Trim(decimal value)
        => value.ToString("0.####", System.Globalization.CultureInfo.InvariantCulture);
}
