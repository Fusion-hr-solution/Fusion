import { hasCorePermission, type AuthUser } from "@repo/auth";
import type { PerformanceAccessDto } from "@repo/api";

/**
 * The Performance capability keys, mirrored from the backend
 * `PerformancePermissions`. Performance owns this contract; these strings must
 * stay in lockstep with `EY.HRPlatform.SharedKernel.Auth.PerformancePermissions`.
 */
const PERFORMANCE_PERMISSION = {
  cycleView: "performance.cycle.view",
  cycleManage: "performance.cycle.manage",
  strategyPublish: "performance.strategy.publish",
  objectiveSelfManage: "performance.objective.self.manage",
  objectiveOrgManage: "performance.objective.org.manage",
} as const;

/**
 * Derives the caller's Performance capabilities from the authenticated session
 * claims alone — the client-side twin of `PerformanceAccessPolicyService`. Every
 * boolean the server computes there is a pure claims check, so the workspace can
 * resolve its presentation gate from the session without a blocking `/access`
 * round-trip. The backend still enforces authorization on every action; this only
 * governs "hide, don't deny" rendering.
 */
export type PerformanceAccess = PerformanceAccessDto & {
  /**
   * Team Performance is a people-leader surface: a workforce member who can see
   * their reports. Tenant administration alone never qualifies — an admin
   * account is a permission profile, not someone with a team.
   */
  canLeadTeam: boolean;
  /**
   * Can enter the Organization direction workspace — organizational responsibility (administration,
   * strategy, organizational objectives) or organizational read breadth. A navigation decision only: it
   * is *not* whether an objective is readable. Anyone may open a published objective their work aligns
   * to in the objective record; the server decides readability per objective.
   */
  canViewOrgDirection: boolean;
};

export function resolvePerformanceAccess(
  user: AuthUser | null,
): PerformanceAccess {
  const canEnter =
    hasCorePermission(user, PERFORMANCE_PERMISSION.cycleView) ||
    hasCorePermission(user, PERFORMANCE_PERMISSION.objectiveSelfManage);

  const aggregateViewScope = resolveAggregateViewScope(user);
  const canAdminister = hasCorePermission(user, PERFORMANCE_PERMISSION.cycleManage, "Tenant");
  const canPublishStrategy = hasCorePermission(user, PERFORMANCE_PERMISSION.strategyPublish, "Tenant");
  const canManageOrgObjectives = hasCorePermission(user, PERFORMANCE_PERMISSION.objectiveOrgManage, "Tenant");
  const hasOrgRead =
    aggregateViewScope === "DirectReports" || aggregateViewScope === "OrgUnit" || aggregateViewScope === "Tenant";

  return {
    canViewOrgDirection: canAdminister || canPublishStrategy || canManageOrgObjectives || hasOrgRead,
    canLeadTeam:
      Boolean(user?.employeeId) &&
      hasCorePermission(user, PERFORMANCE_PERMISSION.cycleView, "DirectReports"),
    canEnter,
    canAdminister,
    canPublishStrategy,
    canParticipate: hasCorePermission(
      user,
      PERFORMANCE_PERMISSION.objectiveSelfManage,
      "Self",
    ),
    canManageOrgObjectives,
    aggregateViewScope,
  };
}

/** The widest granted breadth of the view capability, or null if none. */
function resolveAggregateViewScope(user: AuthUser | null): string | null {
  const key = PERFORMANCE_PERMISSION.cycleView;
  if (hasCorePermission(user, key, "Tenant")) return "Tenant";
  if (hasCorePermission(user, key, "OrgUnit")) return "OrgUnit";
  if (hasCorePermission(user, key, "DirectReports")) return "DirectReports";
  if (hasCorePermission(user, key, "Self")) return "Self";
  return null;
}
