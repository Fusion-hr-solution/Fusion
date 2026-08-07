import { resolveDefaultProductDestination } from "@repo/auth";
import type { AuthUser } from "@repo/auth";

export type ShellEntryState =
  | { kind: "loading" }
  | { kind: "redirect"; destination: string }
  | { kind: "no-usable-context" };

export function resolveShellEntryState({
  isLoading,
  user,
}: {
  isLoading: boolean;
  user: AuthUser | null;
}): ShellEntryState {
  if (isLoading) {
    return { kind: "loading" };
  }

  const destination = resolveDefaultProductDestination(user);
  return destination
    ? { kind: "redirect", destination }
    : { kind: "no-usable-context" };
}
