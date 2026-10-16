import {
  FUSION_HOME_ROUTE,
  resolveDefaultProductDestination,
  type OrganizationReadinessSignal,
} from "@repo/auth";
import type { AuthUser } from "@repo/auth";

export type ShellEntryState =
  | { kind: "loading" }
  /** The shell root renders the Fusion home in place. */
  | { kind: "home" }
  | { kind: "redirect"; destination: string }
  | { kind: "no-usable-context" };

export function resolveShellEntryState({
  isLoading,
  user,
  organizationReady,
  readinessPending = false,
}: {
  isLoading: boolean;
  user: AuthUser | null;
  /** Canonical Organization readiness, when the landing depends on it. */
  organizationReady?: OrganizationReadinessSignal;
  /** True while a required readiness read is still resolving. */
  readinessPending?: boolean;
}): ShellEntryState {
  if (isLoading || readinessPending) {
    return { kind: "loading" };
  }

  const destination = resolveDefaultProductDestination(user, { organizationReady });
  if (destination === FUSION_HOME_ROUTE) return { kind: "home" };
  return destination
    ? { kind: "redirect", destination }
    : { kind: "no-usable-context" };
}
