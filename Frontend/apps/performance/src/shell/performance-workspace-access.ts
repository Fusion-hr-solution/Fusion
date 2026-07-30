import {
  resolveCustomerWorkspaceAccessState,
  type AuthUser,
  type CustomerWorkspaceAccessState,
} from "@repo/auth";

export type PerformanceWorkspaceAccessState = CustomerWorkspaceAccessState;

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
  return resolveCustomerWorkspaceAccessState(input);
}
