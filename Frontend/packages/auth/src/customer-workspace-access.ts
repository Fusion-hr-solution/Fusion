import { canAccessPlatform } from "./roles";
import type { AuthUser } from "./types";

/**
 * Entry decision shared by every customer workspace (Core HR, Performance).
 *
 * `forbidden` is returned for any account holding the Platform Administrator
 * role, not only for accounts whose sole authority is that role. A Platform
 * Administrator account is never an eligible customer tenant member: tenant
 * provisioning refuses to grant it a bootstrap invitation or membership, so a
 * combined Platform-plus-tenant account is not a state the product can reach.
 * Denying on the role therefore matches the product rule rather than
 * over-restricting a legitimate account.
 *
 * This decision governs entry only. Everything past it stays permission-aware:
 * an allowed account still sees just the workspace its tenant-scoped
 * permissions grant.
 */
export type CustomerWorkspaceAccessState =
  | "loading"
  | "sign-in-required"
  | "forbidden"
  | "module-unavailable"
  | "allowed";

/** Modules a customer workspace can require. */
export const CUSTOMER_MODULES = {
  coreHr: "CoreHR",
  performance: "Performance",
} as const;

export type CustomerModule =
  (typeof CUSTOMER_MODULES)[keyof typeof CUSTOMER_MODULES];

export function hasModuleEntitlement(
  user: AuthUser | null,
  module: CustomerModule,
): boolean {
  // Entitlement is meaningful only inside a customer tenant, so an account
  // without one never satisfies it regardless of what the array contains.
  return Boolean(user?.tenantId) && (user?.moduleEntitlements ?? []).includes(module);
}

export function resolveCustomerWorkspaceAccessState({
  isLoading,
  user,
  module,
}: {
  isLoading: boolean;
  user: AuthUser | null;
  /** When given, entry also requires this module to be enabled for the tenant. */
  module?: CustomerModule;
}): CustomerWorkspaceAccessState {
  if (isLoading) {
    return "loading";
  }

  if (!user) {
    return "sign-in-required";
  }

  if (canAccessPlatform(user)) {
    return "forbidden";
  }

  // Customer authority comes from exactly one Active membership. Without a
  // tenant the session carries no customer context at all — the zero, multiple,
  // and inactive-membership cases all arrive here.
  if (!user.tenantId) {
    return "forbidden";
  }

  if (module && !hasModuleEntitlement(user, module)) {
    return "module-unavailable";
  }

  return "allowed";
}
