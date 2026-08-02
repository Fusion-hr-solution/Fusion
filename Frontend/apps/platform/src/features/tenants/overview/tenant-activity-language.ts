import type { TenantActivityEntry } from "../api";
import { eventActor, eventTitle } from "../language";

/**
 * Turning a bounded audit vocabulary into something a person reads.
 *
 * The stored event names are domain terms — `BootstrapCompleted`,
 * `InvitationDeliveryAttempted` — and putting them on screen would make the
 * reader translate. Each entry resolves to a short title and one sentence that
 * names the tenant, so the feed reads as events rather than as a log dump.
 *
 * A delivery attempt is the one event whose meaning depends on its outcome: the
 * same record is either a sent invitation or a bounced one.
 */

export interface ActivityNarrative {
  title: string;
  /** The sentence, split so the tenant name can be rendered as a link. */
  before: string;
  after: string;
  /** True when the platform, not the recipient, has something to fix. */
  isFailure: boolean;
}

function failed(entry: TenantActivityEntry): boolean {
  return entry.outcome.toLowerCase() !== "succeeded";
}

export function activityNarrative(entry: TenantActivityEntry): ActivityNarrative {
  // The title is shared with the tenant record's timeline; only the sentence
  // around the tenant name belongs to this feed.
  const title = eventTitle(entry.eventType, failed(entry));

  switch (entry.eventType) {
    case "TenantProvisioned":
      return {
        title,
        before: "",
        after: " was provisioned successfully.",
        isFailure: false,
      };

    case "InvitationDeliveryAttempted":
      return failed(entry)
        ? {
            title,
            before: "The administrator invitation for ",
            after: " could not be delivered.",
            isFailure: true,
          }
        : {
            title,
            before: "The administrator invitation for ",
            after: " was sent.",
            isFailure: false,
          };

    case "InvitationResent":
      return {
        title,
        before: "The administrator invitation for ",
        after: " was sent again.",
        isFailure: false,
      };

    case "InvitationRevoked":
      return {
        title,
        before: "The administrator invitation for ",
        after: " was revoked.",
        isFailure: false,
      };

    case "InvitationReplaced":
      return {
        title,
        before: "The nominated administrator for ",
        after: " was replaced.",
        isFailure: false,
      };

    case "InvitationReissued":
      return {
        title,
        before: "A new administrator invitation was issued for ",
        after: ".",
        isFailure: false,
      };

    case "BootstrapCompleted":
      return {
        title,
        before: "",
        after: " completed administrator activation.",
        isFailure: false,
      };

    case "ActivationRejected":
      return {
        // The business specification already calls these rejected activation
        // attempts, so the interface uses that word rather than a synonym.
        title: "Activation rejected",
        before: "An activation attempt for ",
        after: " was rejected.",
        isFailure: true,
      };

    default:
      // An event this build has no wording for is still real. It reports the
      // tenant and the outcome rather than disappearing from the history.
      return {
        title,
        before: "An update was recorded for ",
        after: ".",
        isFailure: failed(entry),
      };
  }
}

/**
 * Recent moments read better as "Today at 10:42" than as a date, but only while
 * "today" is still unambiguous. Beyond yesterday it falls back to the date, and
 * the exact timestamp is always available to assistive technology through the
 * element's `dateTime` and title.
 */
export function activityTimestamp(occurredAt: string, now: Date = new Date()): string {
  const at = new Date(occurredAt);

  const time = at.toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
  });

  const days = calendarDaysBetween(at, now);

  if (days === 0) return `Today at ${time}`;
  if (days === 1) return `Yesterday at ${time}`;

  return at.toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    year: at.getFullYear() === now.getFullYear() ? undefined : "numeric",
  });
}

/** Whole calendar days apart, so 23:59 and 00:01 are "yesterday", not "today". */
function calendarDaysBetween(from: Date, to: Date): number {
  const a = new Date(from.getFullYear(), from.getMonth(), from.getDate());
  const b = new Date(to.getFullYear(), to.getMonth(), to.getDate());
  return Math.round((b.getTime() - a.getTime()) / 86_400_000);
}

export function activityActor(entry: TenantActivityEntry): string {
  return eventActor(entry.actorName);
}
