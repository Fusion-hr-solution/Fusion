import { canAccessPlatform, type AuthUser } from "@repo/auth";

export type CoreWorkspaceAccessState =
  | "loading"
  | "sign-in-required"
  | "forbidden"
  | "allowed";

export function buildCoreCallbackUrl(pathname: string, query: string): string {
  const appPath =
    pathname === "/"
      ? "/core"
      : pathname.startsWith("/core")
        ? pathname
        : `/core${pathname}`;
  return `${appPath}${query ? `?${query}` : ""}`;
}

export function resolveCoreWorkspaceAccessState({
  isLoading,
  user,
}: {
  isLoading: boolean;
  user: AuthUser | null;
}): CoreWorkspaceAccessState {
  if (isLoading) {
    return "loading";
  }

  if (!user) {
    return "sign-in-required";
  }

  return canAccessPlatform(user) ? "forbidden" : "allowed";
}
