import type { AuthUser } from "./types";
import {
  canAccessCoreAccess,
  canAccessCoreOverview,
  canAccessCoreOrgChart,
  canAccessCorePeople,
  canAccessCoreSettings,
  canAccessCoreTeam,
  canAccessOwnCoreProfile,
  canAccessPlatform,
  canManageCoreAccessProfiles,
  canViewTenantAdministration,
} from "./roles";
import { CUSTOMER_MODULES, hasModuleEntitlement } from "./customer-workspace-access";

/** The canonical tenant-foundation orientation route. */
export const GETTING_STARTED_ROUTE = "/getting-started";

/**
 * Canonical Organization readiness as the landing decision consumes it.
 * `true`/`false` are known states; `null`/`undefined` mean unknown (loading,
 * errored, or not yet read) and the decision fails closed to Getting Started.
 */
export type OrganizationReadinessSignal = boolean | null | undefined;

/**
 * Whether a user's ordinary landing depends on canonical Organization
 * readiness. Only the Tenant Administrator foundation case does, so no other
 * user pays for a readiness read at entry.
 */
export function landingRequiresOrganizationReadiness(
  user: AuthUser | null
): boolean {
  return Boolean(user?.tenantId) && canViewTenantAdministration(user);
}

const FALLBACK_SHELL_ORIGIN = "http://localhost:3000";
const ENCODED_BACKSLASH = /%5c/i;

function containsControlCharacter(value: string): boolean {
  return Array.from(value).some((character) => {
    const codePoint = character.charCodeAt(0);
    return codePoint <= 0x1f || codePoint === 0x7f;
  });
}

function containsUnsafeEncoding(value: string): boolean {
  let current = value;
  for (let depth = 0; depth < 3; depth += 1) {
    if (current.includes("\\") || containsControlCharacter(current) || ENCODED_BACKSLASH.test(current)) {
      return true;
    }
    try {
      const decoded = decodeURIComponent(current);
      if (decoded === current) return false;
      current = decoded;
    } catch {
      return true;
    }
  }
  return current.includes("\\") || containsControlCharacter(current);
}

export function getTrustedShellOrigin(explicitOrigin?: string): string {
  if (explicitOrigin) return new URL(explicitOrigin).origin;
  if (typeof window !== "undefined") return window.location.origin;
  return FALLBACK_SHELL_ORIGIN;
}

/**
 * Converts a candidate callback into a same-origin path. Authentication
 * callbacks are navigation intent only; the destination still authorizes the
 * restored session.
 */
export function sanitizeInternalReturnPath(
  candidate: string | null | undefined,
  trustedOrigin?: string
): string | null {
  if (!candidate || containsUnsafeEncoding(candidate)) return null;

  try {
    const origin = getTrustedShellOrigin(trustedOrigin);
    const resolved = new URL(candidate, `${origin}/`);
    if (resolved.origin !== origin || resolved.username || resolved.password) {
      return null;
    }
    if (!["http:", "https:"].includes(resolved.protocol)) return null;
    return `${resolved.pathname}${resolved.search}${resolved.hash}`;
  } catch {
    return null;
  }
}

/**
 * Product-aware fallback after ordinary authentication. Known journeys such as
 * invitation acceptance use their own purpose-specific destinations instead.
 *
 * The Tenant Administrator foundation landing is readiness-aware: Ready lands on
 * the operational Core Home (`/core`); anything else — including unknown
 * readiness — lands on Getting Started, which itself reads canonical readiness
 * and renders the truthful state.
 */
export function resolveDefaultProductDestination(
  user: AuthUser | null,
  context: { organizationReady?: OrganizationReadinessSignal } = {}
): string | null {
  if (!user) return null;
  if (canAccessPlatform(user) && !user.tenantId) return "/platform";
  if (!user.tenantId) return null;

  if (canViewTenantAdministration(user)) {
    return context.organizationReady === true ? "/core" : GETTING_STARTED_ROUTE;
  }

  if (hasModuleEntitlement(user, CUSTOMER_MODULES.coreHr)) {
    if (canAccessCoreOverview(user)) return "/core";
    if (canAccessCoreAccess(user)) return "/core/access";
    if (canManageCoreAccessProfiles(user)) return "/core/settings?tab=access-permissions";
    if (canAccessCoreSettings(user)) return "/core/settings";
    if (canAccessCorePeople(user)) return "/core/employees";
    if (canAccessCoreOrgChart(user)) return "/core/organization";
    // Own profile is a safer default than the manager Team workspace. Team stays
    // reachable via navigation, but must never be a blind landing for a user
    // without genuine team context (the /core/team "Failed to load team" defect).
    if (canAccessOwnCoreProfile(user)) return "/core/profile";
    if (canAccessCoreTeam(user)) return "/core/team";
  }

  if (hasModuleEntitlement(user, CUSTOMER_MODULES.performance)) {
    return "/performance";
  }

  return null;
}

export function resolvePostSignInDestination({
  intendedDestination,
  user,
  trustedOrigin,
  organizationReady,
}: {
  intendedDestination?: string | null;
  user: AuthUser | null;
  trustedOrigin?: string;
  organizationReady?: OrganizationReadinessSignal;
}): string | null {
  return (
    sanitizeInternalReturnPath(intendedDestination, trustedOrigin) ??
    resolveDefaultProductDestination(user, { organizationReady })
  );
}
