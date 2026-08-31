import type { StatusTone } from "@repo/ds/shell";
import type {
  WorkforceAccessCommandOutcome,
  WorkforceAccessState,
  WorkforceAccountState,
} from "@repo/api";

/** The roster buckets, in the order the status band reads them. */
export const ROSTER_STATE_ORDER: WorkforceAccessState[] = [
  "ActiveAccount",
  "InvitePending",
  "NotInvited",
  "NeedsReview",
  "Suspended",
];

export const ROSTER_STATE_LABEL: Record<WorkforceAccessState, string> = {
  ActiveAccount: "Active",
  InvitePending: "Pending",
  NotInvited: "No access",
  NeedsReview: "Review",
  Suspended: "Suspended",
};

export const ROSTER_STATE_TONE: Record<WorkforceAccessState, StatusTone> = {
  ActiveAccount: "success",
  InvitePending: "warning",
  NotInvited: "muted",
  NeedsReview: "danger",
  Suspended: "muted",
};

/** Single-person candidate outcome → tone, for the inspector. */
export const CANDIDATE_STATE_TONE: Record<WorkforceAccountState, StatusTone> = {
  NewAccount: "muted",
  ExistingAccountReadyToLink: "info",
  Active: "success",
  BindingConflict: "danger",
  SuspendedAccountReadyToReactivate: "warning",
  ExistingAccountReadyToJoinTenant: "info",
  AccountUnavailable: "danger",
};

/** The one primary action a candidate state offers, phrased for the operator. */
export const CANDIDATE_ACTION_LABEL: Record<string, string> = {
  Activate: "Send invitation",
  Link: "Link this account",
  Reactivate: "Reactivate and link",
  Connect: "Connect account",
};

/**
 * The single bounded server-outcome vocabulary, shared by every workforce-access surface
 * (workspace, Activation Plan, inspector, correction, recipient flow) so a typed result is
 * worded and toned the same everywhere. `Ok` is the only success; the rest fail closed and
 * carry the server's non-disclosing message, with these fallbacks when one is absent.
 */
export const COMMAND_OUTCOME_TONE: Record<WorkforceAccessCommandOutcome, StatusTone> = {
  Ok: "success",
  Stale: "warning",
  Conflict: "danger",
  Unavailable: "danger",
  Blocked: "warning",
  Failed: "danger",
};

const COMMAND_OUTCOME_FALLBACK: Record<WorkforceAccessCommandOutcome, string> = {
  Ok: "Done.",
  Stale: "This changed since you reviewed it. Review it again.",
  Conflict: "That person is already linked to another account.",
  Unavailable: "This account cannot be used here.",
  Blocked: "This could not be completed.",
  Failed: "Something went wrong. Try again.",
};

export function isCommandSuccess(outcome: WorkforceAccessCommandOutcome): boolean {
  return outcome === "Ok";
}

/** The message to show for a typed outcome: the server's, or the shared fallback. */
export function commandOutcomeMessage(
  outcome: WorkforceAccessCommandOutcome,
  serverMessage?: string | null
): string {
  return serverMessage?.trim() || COMMAND_OUTCOME_FALLBACK[outcome];
}

export function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return (parts[0]![0]! + parts[parts.length - 1]![0]!).toUpperCase();
}

export function baselineLabel(directReportCount: number): string {
  return directReportCount > 0
    ? `Manager · ${directReportCount} report${directReportCount === 1 ? "" : "s"}`
    : "Employee";
}
