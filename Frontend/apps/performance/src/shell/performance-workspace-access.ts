import {
  CUSTOMER_MODULES,
  canEnterPerformance,
  resolveCustomerWorkspaceAccessState,
  type AuthUser,
  type CustomerWorkspaceAccessState,
} from "@repo/auth";

/** `no-access`: the tenant has Performance, but this person holds none of its entry permissions. */
export type PerformanceWorkspaceAccessState = CustomerWorkspaceAccessState | "no-access";

export function buildPerformanceCallbackUrl(
  pathname: string,
  query: string
): string {
  const appPath =
    pathname === "/"
      ? "/performance"
      : pathname.startsWith("/performance")
        ? pathname
        : `/performance${pathname}`;
  return `${appPath}${query ? `?${query}` : ""}`;
}

export function resolvePerformanceWorkspaceAccessState(input: {
  isLoading: boolean;
  user: AuthUser | null;
}): PerformanceWorkspaceAccessState {
  const state = resolveCustomerWorkspaceAccessState({ ...input, module: CUSTOMER_MODULES.performance });
  // One entry rule for every door into Performance: the same check the Fusion home and Core HR use.
  return state === "allowed" && !canEnterPerformance(input.user) ? "no-access" : state;
}
