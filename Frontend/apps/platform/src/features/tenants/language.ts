import type { StatusTone } from "@repo/ds/shell";
import type {
  DeliveryOutcomeValue,
  InvitationStateValue,
  TenantActivationStatus,
  TenantModule,
} from "./api";

/**
 * The single terminology source for the Platform tenant journey.
 *
 * Domain vocabulary and user-facing wording differ on purpose in a few places —
 * a `Superseded` invitation reads as `Replaced` — so every screen resolves its
 * words here instead of formatting enum names locally.
 */

export const TENANT_STATUS_LABEL: Record<TenantActivationStatus, string> = {
  AwaitingAdministratorActivation: "Awaiting administrator activation",
  Active: "Active",
};

export const TENANT_STATUS_TONE: Record<TenantActivationStatus, StatusTone> = {
  AwaitingAdministratorActivation: "info",
  Active: "success",
};

export const INVITATION_LABEL: Record<InvitationStateValue, string> = {
  Pending: "Pending",
  Accepted: "Accepted",
  Expired: "Expired",
  Revoked: "Revoked",
  Superseded: "Replaced",
};

export const DELIVERY_LABEL: Record<DeliveryOutcomeValue, string> = {
  Sent: "Sent",
  Failed: "Delivery failed",
};

interface ModuleEntry {
  id: TenantModule;
  label: string;
  /**
   * Core HR is the workforce truth every other module reads, so it is granted
   * with the tenant rather than chosen. The list says so instead of presenting
   * it as an entitlement someone selected.
   */
  mandatory: boolean;
}

/**
 * The supported module catalogue, keyed by the stable identifier the service
 * stores. Filtering and export use these identifiers; only the display layer
 * uses the labels.
 */
export const MODULE_CATALOGUE: ModuleEntry[] = [
  { id: "CoreHR", label: "Core HR", mandatory: true },
  { id: "Performance", label: "Performance", mandatory: false },
];

export const MODULE_IDS: TenantModule[] = MODULE_CATALOGUE.map((entry) => entry.id);

const MODULE_LABEL: Record<TenantModule, string> = Object.fromEntries(
  MODULE_CATALOGUE.map((entry) => [entry.id, entry.label])
) as Record<TenantModule, string>;

/**
 * A module the catalogue does not know yet still has to render truthfully — a
 * tenant entitled to something this build has no label for is a real state, not
 * a reason to show a blank.
 */
export function moduleLabel(id: string): string {
  return MODULE_LABEL[id as TenantModule] ?? id;
}

export function isModuleMandatory(id: string): boolean {
  return MODULE_CATALOGUE.find((entry) => entry.id === id)?.mandatory ?? false;
}

/**
 * The one title for each recorded event, shared by the tenant record's timeline
 * and the directory's activity feed so the two cannot come to call the same
 * event different things.
 *
 * A delivery attempt is the only event whose meaning depends on its outcome:
 * the same record is either a sent invitation or a bounced one, and
 * "delivery attempted" tells the reader neither.
 */
const EVENT_TITLE: Record<string, string> = {
  TenantProvisioned: "Tenant provisioned",
  InvitationResent: "Invitation resent",
  InvitationRevoked: "Invitation revoked",
  InvitationReplaced: "Invited email replaced",
  InvitationReissued: "Invitation reissued",
  ActivationRejected: "Activation rejected",
  BootstrapCompleted: "Administrator activated",
};

/**
 * The outcomes the service records as success.
 *
 * There are two words, not one: most events settle as `Succeeded`, but a
 * delivery attempt settles as `Sent` or `Failed`. Testing for `Succeeded` alone
 * silently reported every delivered invitation as a bounce.
 */
const SUCCESS_OUTCOMES = new Set(["succeeded", "sent"]);

/**
 * Whether a recorded event represents a failure.
 *
 * An outcome this build does not recognise counts as a failure. That is the
 * conservative direction: an unexplained event shown as a problem invites a
 * look, whereas one shown as success is a false success — the thing the record
 * must never claim.
 */
export function isFailureOutcome(outcome: string): boolean {
  return !SUCCESS_OUTCOMES.has(outcome.trim().toLowerCase());
}

export function eventTitle(eventType: string, failed: boolean): string {
  if (eventType === "InvitationDeliveryAttempted") {
    return failed ? "Invitation delivery failed" : "Invitation sent";
  }

  // An event this build has no wording for is still real; it reports what it
  // can rather than leaking the stored name.
  return EVENT_TITLE[eventType] ?? "Tenant activity";
}

/** Null actor means the platform acted; the interface says so rather than blank. */
export function eventActor(actorName: string | null): string {
  return actorName?.trim() || "Fusion Platform";
}

const RECOVERY_LABEL: Record<string, string> = {
  resend: "Resend invitation",
  revoke: "Revoke invitation",
  replace: "Replace invited email",
  reissue: "Reissue invitation",
};

export function recoveryLabel(action: string): string {
  return RECOVERY_LABEL[action] ?? action;
}

/**
 * Both formatters are built once rather than per call. `toLocaleString` with an
 * options object constructs a formatter internally every time, and these are
 * called inside timeline and table row loops.
 *
 * Created lazily so the runtime's locale is resolved in the browser rather than
 * being fixed at module-evaluation time on the server.
 */
let dateFormat: Intl.DateTimeFormat | undefined;
let dateTimeFormat: Intl.DateTimeFormat | undefined;

export function formatDate(value: string): string {
  dateFormat ??= new Intl.DateTimeFormat(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
  return dateFormat.format(new Date(value));
}

export function formatDateTime(value: string): string {
  dateTimeFormat ??= new Intl.DateTimeFormat(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
  return dateTimeFormat.format(new Date(value));
}

/** Whole days from now, negative once the moment has passed. */
export function daysUntil(value: string): number {
  const ms = new Date(value).getTime() - Date.now();
  return Math.ceil(ms / 86_400_000);
}
