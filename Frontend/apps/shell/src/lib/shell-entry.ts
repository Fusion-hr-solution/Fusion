import { canAccessPlatform } from "@repo/auth";
import type { AuthUser } from "@repo/auth";

export type ShellEntryState = "loading" | "platform" | "home";

export function resolveShellEntryState({
  isLoading,
  user,
}: {
  isLoading: boolean;
  user: AuthUser | null;
}): ShellEntryState {
  if (isLoading) {
    return "loading";
  }

  return canAccessPlatform(user) ? "platform" : "home";
}
