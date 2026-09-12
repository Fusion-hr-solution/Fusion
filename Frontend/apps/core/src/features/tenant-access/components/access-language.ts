import type {
  AdministratorInvitationState,
  ContinuityState,
  TenantAdministratorStatus,
} from "@repo/api";
import type { StatusTone } from "@repo/ds/shell";

/**
 * The one terminology source for Access.
 *
 * Status words are business-facing and never leak an internal enum name. Every
 * state carries a tone, but the tone never carries the meaning on its own — the
 * label is always rendered beside it.
 */

export type AccessTone = "neutral" | "positive" | "caution" | "muted";

export const ADMINISTRATOR_STATUS_LABEL: Record<
  TenantAdministratorStatus,
  string
> = {
  Active: "Active",
  Suspended: "Suspended",
};

export const ADMINISTRATOR_STATUS_TONE: Record<
  TenantAdministratorStatus,
  AccessTone
> = {
  Active: "positive",
  Suspended: "caution",
};

export const INVITATION_STATE_LABEL: Record<
  AdministratorInvitationState,
  string
> = {
  Pending: "Invitation pending",
  Accepted: "Accepted",
  Expired: "Expired",
  Revoked: "Revoked",
  Superseded: "Replaced",
};

export const INVITATION_STATE_TONE: Record<
  AdministratorInvitationState,
  AccessTone
> = {
  Pending: "caution",
  Accepted: "positive",
  Expired: "muted",
  Revoked: "muted",
  Superseded: "muted",
};

/**
 * Administrative continuity — the one judgment the rows cannot show. Whether the
 * tenant is safely administered is computed by the service from active, suspended,
 * and usable counts; the page leads with it rather than making an administrator
 * infer it from the list.
 */
export const CONTINUITY_LABEL: Record<ContinuityState, string> = {
  Healthy: "Secure",
  AtRisk: "At risk",
  RecoveryRequired: "No administrator",
};

export const CONTINUITY_TONE: Record<ContinuityState, StatusTone> = {
  Healthy: "success",
  AtRisk: "warning",
  RecoveryRequired: "danger",
};

/**
 * Shown only when continuity actually needs attention. Named consequence and a
 * recovery path — never a caption on the healthy, ordinary case.
 */
export const CONTINUITY_ADVISORY: Record<ContinuityState, string | null> = {
  Healthy: null,
  AtRisk:
    "One administrator is a single point of failure. Invite another so access can't be lost with them.",
  RecoveryRequired:
    "No one can administer this tenant. Invite an administrator to restore access.",
};

/**
 * Copy that carries a business consequence. Stated once here so a confirmation,
 * a refusal, and a row can never drift into describing the same rule differently.
 */
export const COPY = {
  pageDescription: "Manage who can administer this tenant.",

  soleAdministrator: "Sole administrator",

  suspendConsequence:
    "This person will no longer be able to access this tenant. Their account and administrator assignment will remain.",

  reactivateConsequence:
    "This person will be able to access this tenant again.",

  removeConsequence:
    "This person will lose Tenant Administrator permissions. Their Fusion account and access history will remain.",

  selfRemoveConsequence:
    "You will lose Tenant Administrator permissions immediately, including access to this page.",

  revokeInvitationConsequence:
    "The invitation link will stop working. No account or access is created from it.",

  replaceEmailConsequence:
    "The current invitation stops working and a new one is sent to the replacement address.",

  duplicatePending: "A pending invitation already exists for this address.",
  existingAccount: "This address already belongs to a Fusion account.",
  authorizationChanged:
    "You no longer have permission to invite administrators.",
  staleState:
    "This changed while you were looking at it. The latest state is now shown.",

  noAdministrators: "No one administers this tenant yet.",
  noActivity: "Nothing has changed here yet.",
} as const;

/**
 * What a recorded event reads as. Falling back to the service's own summary keeps
 * activity truthful when a new event type ships before this map knows about it.
 */
export const ACTIVITY_LABEL: Record<string, string> = {
  AdministratorAuthorityRecognized: "Administrator access established",
  AdministratorInvitationIssued: "Administrator invited",
  AdministratorInvitationResent: "Invitation resent",
  AdministratorInvitationEmailReplaced: "Invitation address changed",
  AdministratorInvitationRevoked: "Invitation revoked",
  AdministratorInvitationAccepted: "Invitation accepted",
  AdministratorInvitationRejectedExistingAccount:
    "Invitation could not be accepted",
  MembershipSuspended: "Access suspended",
  MembershipReactivated: "Access reactivated",
  AdministratorAuthorityGranted: "Administrator access established",
  AdministratorAuthorityRevoked: "Administrator access removed",
  AdministratorAuthoritySelfRemoved: "Administrator removed their own access",
  FinalAdministratorActionBlocked:
    "Action blocked to keep the tenant administered",
  PlatformRecoveryInitiated: "Recovery started",
  PlatformRecoveryInvitationAccepted: "Recovery invitation accepted",
  PlatformRecoveryCompleted: "Administrator access recovered",
  PlatformRecoveryFailed: "Recovery failed",
};

/**
 * The service stores this placeholder when a command supplied no actor name, and
 * resolves the person on read. Anything still carrying it is genuinely
 * unattributable, so the interface says nothing rather than saying "Unknown".
 */
const UNRESOLVED_ACTOR = "Unknown";

export function actorLabel(actorName: string): string | null {
  const trimmed = actorName.trim();
  return trimmed.length === 0 || trimmed === UNRESOLVED_ACTOR ? null : trimmed;
}

const DAY = new Intl.DateTimeFormat(undefined, {
  day: "numeric",
  month: "short",
  year: "numeric",
});
const MOMENT = new Intl.DateTimeFormat(undefined, {
  day: "numeric",
  month: "short",
  hour: "numeric",
  minute: "2-digit",
});

export function formatDay(value: string): string {
  return DAY.format(new Date(value));
}

export function formatMoment(value: string): string {
  return MOMENT.format(new Date(value));
}

/**
 * A whole-day relative distance from now, so an expiry reads "in 14 days" rather
 * than making the reader subtract two calendar dates. Past values read "expired".
 */
export function formatRelativeDays(value: string): string {
  const days = Math.round(
    (new Date(value).getTime() - Date.now()) / 86_400_000
  );
  if (days < 0) return "expired";
  if (days === 0) return "today";
  if (days === 1) return "tomorrow";
  return `in ${days} days`;
}

export function isPast(value: string): boolean {
  return new Date(value).getTime() < Date.now();
}
