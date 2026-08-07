import {
  CUSTOMER_MODULES,
  canAccessCoreAccess,
  canViewTenantAdministration,
  resolveCustomerWorkspaceAccessState,
  sanitizeInternalReturnPath,
  type AuthUser,
  type CustomerWorkspaceAccessState,
} from "@repo/auth";

export type CoreWorkspaceAccessState = CustomerWorkspaceAccessState;

export function isTenantLevelCoreRoute(pathname: string): boolean {
  const path = pathname.replace(/^\/core/, "") || "/";
  return (
    path === "/tenant-setup" ||
    pathname === "/setup" ||
    path === "/access" ||
    path.startsWith("/access/")
  );
}

export function buildCoreCallbackUrl(pathname: string, query: string): string {
  const canonicalPath =
    pathname === "/tenant-setup" || pathname === "/core/tenant-setup"
      ? "/setup"
      : pathname;
  const appPath =
    canonicalPath === "/"
      ? "/core"
      : canonicalPath.startsWith("/core") || canonicalPath === "/setup"
        ? canonicalPath
        : `/core${canonicalPath}`;
  return sanitizeInternalReturnPath(`${appPath}${query ? `?${query}` : ""}`) ?? "/core";
}

export function resolveCoreWorkspaceAccessState(input: {
  isLoading: boolean;
  user: AuthUser | null;
  pathname?: string;
}): CoreWorkspaceAccessState {
  const baseState = resolveCustomerWorkspaceAccessState({
    isLoading: input.isLoading,
    user: input.user,
    module: input.pathname && isTenantLevelCoreRoute(input.pathname)
      ? undefined
      : CUSTOMER_MODULES.coreHr,
  });
  if (baseState !== "allowed" || !input.pathname) return baseState;

  const path = input.pathname.replace(/^\/core/, "") || "/";
  if (
    (path === "/tenant-setup" || input.pathname === "/setup") &&
    !canViewTenantAdministration(input.user)
  ) {
    return "forbidden";
  }
  if ((path === "/access" || path.startsWith("/access/")) && !canAccessCoreAccess(input.user)) {
    return "forbidden";
  }
  return "allowed";
}
