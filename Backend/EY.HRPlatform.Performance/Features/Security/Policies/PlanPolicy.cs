using EY.HRPlatform.Performance.Domain.Objectives;
using EY.HRPlatform.Performance.Domain.Plans;
using EY.HRPlatform.Performance.Domain.Cycles;
using EY.HRPlatform.Performance.Features.Goals;
using EY.HRPlatform.Performance.Features.Plans;

namespace EY.HRPlatform.Performance.Features.Security.Policies;

public static class PlanPolicy
{
    public static bool HasBeenPutForward(EmployeePlan plan) => plan.State != PlanLifecycleState.Draft || plan.Decisions.Count > 0;
    public static bool IsResponsibleReviewer(GoalActorContext actor, EmployeePlan plan)
        => actor.CallerEmployeeId != Guid.Empty && actor.CanReviewReports && plan.ResponsibleManagerId == actor.CallerEmployeeId;
    public static bool CanRead(GoalActorContext actor, EmployeePlan plan)
        => actor.IsAdmin || (actor.CallerEmployeeId != Guid.Empty && plan.EmployeeId == actor.CallerEmployeeId)
            || (IsResponsibleReviewer(actor, plan) && HasBeenPutForward(plan));
    public static IQueryable<EmployeePlan> Readable(IQueryable<EmployeePlan> plans, GoalActorContext actor)
        => plans.Where(plan => actor.IsAdmin
            || (actor.CallerEmployeeId != Guid.Empty && plan.EmployeeId == actor.CallerEmployeeId)
            || (actor.CallerEmployeeId != Guid.Empty && actor.CanReviewReports && plan.ResponsibleManagerId == actor.CallerEmployeeId
                && (plan.State != PlanLifecycleState.Draft || plan.Decisions.Any())));
    public static bool CanAuthor(EmployeePlan plan, PlanActorContext actor)
        => actor.CallerEmployeeId != Guid.Empty && plan.EmployeeId == actor.CallerEmployeeId && plan.State == PlanLifecycleState.Draft;
    public static bool CanDecide(EmployeePlan plan, PlanActorContext actor) => IsResponsibleReviewer(actor.ToGoalActor(), plan);
    public static bool CanRequestUpdate(GoalActorContext actor, EmployeePlan plan, PerformanceCycle cycle)
        => IsResponsibleReviewer(actor, plan) && plan.State == PlanLifecycleState.Approved && cycle.IsActive;
    public static bool CanApproveExceptionally(PlanActorContext actor) => actor.IsAdmin;
    /// <summary>The responsible reviewer acknowledges an unacknowledged At risk or Off track report while the plan executes.</summary>
    public static bool CanAcknowledgeStatus(GoalActorContext actor, EmployeePlan plan, PerformanceCycle cycle, Objective objective)
        => CanRequestUpdate(actor, plan, cycle) && objective.EmployeePlanId == plan.Id && objective.NeedsStatusAttention;
}
