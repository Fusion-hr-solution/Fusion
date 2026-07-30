import { canAccessPlatform } from "@repo/auth";
import type { AuthUser } from "@repo/auth";

export type PlatformAccessState =
  | "loading"
  | "sign-in-required"
  | "forbidden"
  | "allowed";

export function buildPlatformCallbackUrl(
  pathname: string,
  query: string
): string {
  const appPath =
    pathname === "/"
      ? "/platform"
      : pathname.startsWith("/platform")
        ? pathname
        : `/platform${pathname}`;
  return `${appPath}${query ? `?${query}` : ""}`;
}

export function resolvePlatformAccessState({
  isLoading,
  user,
}: {
  isLoading: boolean;
  user: AuthUser | null;
}): PlatformAccessState {
  if (isLoading) {
    return "loading";
  }

  if (!user) {
    return "sign-in-required";
  }

  return canAccessPlatform(user) ? "allowed" : "forbidden";
}
