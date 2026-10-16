import type { AuthUser } from "./types";
import { canAccessPlatform, canViewTenantAdministration } from "./roles";
import { canEnterCoreHr, canEnterPerformance } from "./customer-workspace-access";

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

/** The Fusion home at the shell root (D-31). */
export const FUSION_HOME_ROUTE = "/";

/**
 * Product-aware fallback after ordinary authentication. Known journeys such as
 * invitation acceptance use their own purpose-specific destinations instead.
 *
 * Tenant users land on the Fusion home when they can enter at least one module.
 * The Tenant Administrator foundation landing stays readiness-aware: Ready lands
 * on the home; anything else, including unknown readiness, lands on Getting
 * Started, which itself reads canonical readiness and renders the truthful state.
 */
export function resolveDefaultProductDestination(
  user: AuthUser | null,
  context: { organizationReady?: OrganizationReadinessSignal } = {}
): string | null {
  if (!user) return null;
  if (canAccessPlatform(user) && !user.tenantId) return "/platform";
  if (!user.tenantId) return null;

  if (canViewTenantAdministration(user)) {
    return context.organizationReady === true ? FUSION_HOME_ROUTE : GETTING_STARTED_ROUTE;
  }

  return canEnterCoreHr(user) || canEnterPerformance(user) ? FUSION_HOME_ROUTE : null;
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
