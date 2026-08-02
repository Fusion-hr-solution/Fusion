import {
  CUSTOMER_MODULES,
  resolveCustomerWorkspaceAccessState,
  type AuthUser,
  type CustomerWorkspaceAccessState,
} from "@repo/auth";

export type CoreWorkspaceAccessState = CustomerWorkspaceAccessState;

export function buildCoreCallbackUrl(pathname: string, query: string): string {
  const appPath =
    pathname === "/"
      ? "/core"
      : pathname.startsWith("/core")
        ? pathname
        : `/core${pathname}`;
  return `${appPath}${query ? `?${query}` : ""}`;
}

export function resolveCoreWorkspaceAccessState(input: {
  isLoading: boolean;
  user: AuthUser | null;
}): CoreWorkspaceAccessState {
  // Direct entry is gated, not just navigation: reaching /core by URL still
  // requires the tenant's Core HR entitlement.
  return resolveCustomerWorkspaceAccessState({
    ...input,
    module: CUSTOMER_MODULES.coreHr,
  });
}
