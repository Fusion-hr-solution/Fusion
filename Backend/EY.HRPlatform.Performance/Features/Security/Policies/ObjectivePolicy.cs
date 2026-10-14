using EY.HRPlatform.Performance.Domain.Objectives;
using EY.HRPlatform.Performance.Domain.Plans;
using EY.HRPlatform.Performance.Features.Goals;

namespace EY.HRPlatform.Performance.Features.Security.Policies;

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
public static class ObjectivePolicy
{
    public static IQueryable<Objective> Readable(IQueryable<Objective> objectives, IQueryable<EmployeePlan> plans, CycleViewer viewer)
    {
        var actor = viewer.Actor;
        var unit = viewer.GovernedOrgUnitId;
        var readablePlanIds = PlanPolicy.Readable(plans, actor).Select(plan => plan.Id);
        return objectives.Where(objective =>
            (objective.OwnershipScope == ObjectiveOwnershipScope.Company
                && ((objective.State == ObjectiveLifecycleState.Published || objective.State == ObjectiveLifecycleState.Archived) || actor.IsAdmin || actor.CanPublishStrategy))
            || (objective.OwnershipScope == ObjectiveOwnershipScope.OrgUnit
                && ((objective.State == ObjectiveLifecycleState.Published || objective.State == ObjectiveLifecycleState.Archived) || actor.IsAdmin
                    || (unit != null && objective.OrgUnitId == unit)
                    || (actor.CallerEmployeeId != Guid.Empty && objective.AccountablePersonId == actor.CallerEmployeeId)))
            || (objective.OwnershipScope == ObjectiveOwnershipScope.Employee && objective.EmployeePlanId != null
                && readablePlanIds.Contains(objective.EmployeePlanId.Value)));
    }

    public static bool CanRead(CycleViewer viewer, Objective objective, EmployeePlan? plan)
        => objective.OwnershipScope switch
        {
            // A Draft of company direction stays with the strategy owner and administrators.
            ObjectiveOwnershipScope.Company => (objective.State == ObjectiveLifecycleState.Published || objective.State == ObjectiveLifecycleState.Archived)
                || CanManageStrategy(viewer.Actor)
                || viewer.Actor.IsAdmin,
            ObjectiveOwnershipScope.OrgUnit => (objective.State == ObjectiveLifecycleState.Published || objective.State == ObjectiveLifecycleState.Archived)
                || Governs(viewer, objective)
                || IsAccountable(viewer.Actor, objective),
            ObjectiveOwnershipScope.Employee => plan is not null && PlanPolicy.CanRead(viewer.Actor, plan),
            _ => false,
        };

    /// <summary>
    /// Named progress detail — the individual history and evidence behind a progress figure. Stricter than
    /// <see cref="CanRead"/>: an aligned reader sees the figure on the objective, not who recorded what.
    /// </summary>
    public static bool CanReadProgressHistory(CycleViewer viewer, Objective objective, EmployeePlan? plan)
    {
        var actor = viewer.Actor;
        if (!CanRead(viewer, objective, plan)) return false;
        if (actor.IsAdmin || IsAccountable(actor, objective)) return true;
        return objective.OwnershipScope switch
        {
            ObjectiveOwnershipScope.Employee => plan is not null && PlanPolicy.IsResponsibleReviewer(actor, plan),
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
    public static bool CanGovern(CycleViewer viewer, Objective objective)
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
    public static bool CanMaintain(CycleViewer viewer, Objective objective)
        => CanGovern(viewer, objective)
            || (objective.OwnershipScope == ObjectiveOwnershipScope.OrgUnit && IsAccountable(viewer.Actor, objective));

    private static bool CanManageStrategy(GoalActorContext actor) => actor.CanPublishStrategy;

    private static bool Governs(CycleViewer viewer, Objective objective)
        => objective.OwnershipScope == ObjectiveOwnershipScope.OrgUnit
            && objective.OrgUnitId is Guid unitId
            && (viewer.Actor.IsAdmin || viewer.GovernedOrgUnitId == unitId);

    private static bool IsAccountable(GoalActorContext actor, Objective objective)
        => actor.CallerEmployeeId != Guid.Empty && objective.AccountablePersonId == actor.CallerEmployeeId;
}
