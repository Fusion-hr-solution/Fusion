using EY.HRPlatform.Performance.Domain.Cycles;
using EY.HRPlatform.Performance.Domain.Objectives;
using EY.HRPlatform.Performance.Domain.Plans;
using EY.HRPlatform.Performance.Infrastructure.Core;

namespace EY.HRPlatform.Performance.Features.Goals;

/// <summary>
/// The caller as seen by objective access decisions: their token-derived capabilities plus the one
/// contextual fact objective governance needs — the team they were assigned to at Cycle start, when
/// they hold the organizational-objective grant. Resolved once per request so a list can be filtered
/// without a Core round-trip per objective.
/// </summary>
public sealed record ObjectiveViewer(GoalActorContext Actor, Guid? GovernedOrgUnitId)
{
    public static async Task<ObjectiveViewer> ResolveAsync(
        ICoreWorkforceClient workforce,
        PerformanceCycle cycle,
        GoalActorContext actor,
        CancellationToken cancellationToken)
    {
        if (actor.IsAdmin || !actor.HasOrgManageGrant || actor.CallerEmployeeId == Guid.Empty)
            return new ObjectiveViewer(actor, null);

        var caller = (await workforce.ResolveAsync(
                cycle.StartDate.ToDateTime(TimeOnly.MinValue),
                [actor.CallerEmployeeId],
                cancellationToken))
            .SingleOrDefault();
        return new ObjectiveViewer(
            actor,
            caller is { IsActive: true, OrgUnit: not null } ? caller.OrgUnit.OrgUnitId : null);
    }
}

/// <summary>
/// The single authority for who may see and act on an objective, across every scope (Company, OrgUnit,
/// Employee) and every surface that returns one — detail, overview, strategy, traversal, progress.
/// Capabilities are one family derived from the same rules, so "can read" and "can edit" never drift.
/// <para>
/// Read rule: published direction (Company, OrgUnit) is readable by every Performance entrant — it is
/// what plans align to. A Draft stays with the people who can shape it. An Employee objective is part
/// of a person's plan and follows plan visibility: the owner, administration, and the responsible
/// manager once the plan has been put forward.
/// </para>
/// <para>
/// Reading a published objective is not the same as entering the Organization direction workspace —
/// that is a navigation decision made by the client from the caller's capabilities.
/// </para>
/// </summary>
public static class ObjectiveAccess
{
    public static bool CanRead(ObjectiveViewer viewer, Objective objective, EmployeePlan? plan)
        => objective.OwnershipScope switch
        {
            // A Draft of company direction stays with the strategy owner and administrators.
            ObjectiveOwnershipScope.Company => objective.State == ObjectiveLifecycleState.Published
                || CanManageStrategy(viewer.Actor)
                || viewer.Actor.IsAdmin,
            ObjectiveOwnershipScope.OrgUnit => objective.State == ObjectiveLifecycleState.Published
                || Governs(viewer, objective)
                || IsAccountable(viewer.Actor, objective),
            ObjectiveOwnershipScope.Employee => plan is not null && CanViewPlan(viewer.Actor, plan),
            _ => false,
        };

    /// <summary>
    /// Named progress detail — the individual history and evidence behind a progress figure. Stricter than
    /// <see cref="CanRead"/>: an aligned reader sees the figure on the objective, not who recorded what.
    /// </summary>
    public static bool CanReadProgressHistory(ObjectiveViewer viewer, Objective objective, EmployeePlan? plan)
    {
        var actor = viewer.Actor;
        if (actor.IsAdmin || IsAccountable(actor, objective)) return true;
        return objective.OwnershipScope switch
        {
            ObjectiveOwnershipScope.Employee => plan is not null && IsResponsibleManager(actor, plan),
            ObjectiveOwnershipScope.OrgUnit => Governs(viewer, objective),
            _ => false,
        };
    }

    /// <summary>Only the accountable owner records progress, once the objective's baseline is set.</summary>
    public static bool CanUpdateProgress(GoalActorContext actor, Objective objective, EmployeePlan? plan)
    {
        if (!IsAccountable(actor, objective)) return false;
        return objective.OwnershipScope switch
        {
            ObjectiveOwnershipScope.Employee => plan is not null && plan.State == PlanLifecycleState.Approved,
            ObjectiveOwnershipScope.OrgUnit or ObjectiveOwnershipScope.Company =>
                objective.State == ObjectiveLifecycleState.Published,
            _ => false,
        };
    }

    /// <summary>
    /// Scope governance: the authority to publish and remove. Company direction is governed by strategy
    /// publishers; a team objective by administration or the team's own manager. Employee objectives are
    /// governed through their plan, not here.
    /// </summary>
    public static bool CanGovern(ObjectiveViewer viewer, Objective objective)
        => objective.OwnershipScope switch
        {
            ObjectiveOwnershipScope.Company => CanManageStrategy(viewer.Actor),
            ObjectiveOwnershipScope.OrgUnit => Governs(viewer, objective),
            _ => false,
        };

    /// <summary>
    /// Maintenance of a definition: governance, plus a team objective's own accountable person. Being made
    /// accountable never confers publish, so reassigning the owner cannot take publish from the governor.
    /// </summary>
    public static bool CanMaintain(ObjectiveViewer viewer, Objective objective)
        => CanGovern(viewer, objective)
            || (objective.OwnershipScope == ObjectiveOwnershipScope.OrgUnit && IsAccountable(viewer.Actor, objective));

    /// <summary>
    /// A plan is the employee's own workspace until it is put forward: the owner and administration see it
    /// always, the responsible manager once it has been submitted (or decided on).
    /// </summary>
    public static bool CanViewPlan(GoalActorContext actor, EmployeePlan plan)
        => plan.EmployeeId == actor.CallerEmployeeId
            || actor.IsAdmin
            || (IsResponsibleManager(actor, plan) && HasBeenPutForward(plan));

    public static bool HasBeenPutForward(EmployeePlan plan)
        => plan.State != PlanLifecycleState.Draft || plan.Decisions.Count > 0;

    private static bool IsResponsibleManager(GoalActorContext actor, EmployeePlan plan)
        => actor.CanReviewReports
            && plan.ResponsibleManagerId is not null
            && plan.ResponsibleManagerId == actor.CallerEmployeeId;

    private static bool CanManageStrategy(GoalActorContext actor) => actor.CanPublishStrategy;

    private static bool Governs(ObjectiveViewer viewer, Objective objective)
        => objective.OwnershipScope == ObjectiveOwnershipScope.OrgUnit
            && objective.OrgUnitId is Guid unitId
            && (viewer.Actor.IsAdmin || viewer.GovernedOrgUnitId == unitId);

    private static bool IsAccountable(GoalActorContext actor, Objective objective)
        => actor.CallerEmployeeId != Guid.Empty && objective.AccountablePersonId == actor.CallerEmployeeId;
}
