import {
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
  return resolveCustomerWorkspaceAccessState(input);
}
