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
export function resolvePerformanceAccess(
  user: AuthUser | null,
): PerformanceAccessDto {
  const canEnter =
    hasCorePermission(user, PERFORMANCE_PERMISSION.cycleView) ||
    hasCorePermission(user, PERFORMANCE_PERMISSION.objectiveSelfManage);

  return {
    canEnter,
    canAdminister: hasCorePermission(
      user,
      PERFORMANCE_PERMISSION.cycleManage,
      "Tenant",
    ),
    canPublishStrategy: hasCorePermission(
      user,
      PERFORMANCE_PERMISSION.strategyPublish,
      "Tenant",
    ),
    canParticipate: hasCorePermission(
      user,
      PERFORMANCE_PERMISSION.objectiveSelfManage,
      "Self",
    ),
    canManageOrgObjectives: hasCorePermission(
      user,
      PERFORMANCE_PERMISSION.objectiveOrgManage,
      "Tenant",
    ),
    aggregateViewScope: resolveAggregateViewScope(user),
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
