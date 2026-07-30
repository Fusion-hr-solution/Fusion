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
  | "allowed";

export function resolveCustomerWorkspaceAccessState({
  isLoading,
  user,
}: {
  isLoading: boolean;
  user: AuthUser | null;
}): CustomerWorkspaceAccessState {
  if (isLoading) {
    return "loading";
  }

  if (!user) {
    return "sign-in-required";
  }

  return canAccessPlatform(user) ? "forbidden" : "allowed";
}
