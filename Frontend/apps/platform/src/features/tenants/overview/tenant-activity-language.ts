import type { TenantActivityEntry } from "../api";
import { isFailureOutcome, tenantWords, type TenantWords } from "../language";
import { formatDateParts } from "@repo/ds/lib/dates";

/**
 * Turning a bounded audit vocabulary into something a person reads.
 *
 * The stored event names are domain terms — `BootstrapCompleted`,
 * `InvitationDeliveryAttempted` — and putting them on screen would make the
 * reader translate. Each entry resolves to a short title and one sentence that
 * names the tenant, so the feed reads as events rather than as a log dump. The
 * sentences live in the `tenants` catalogue with a {tenant} slot; the slot is
 * where the sentence splits so the name can be rendered as a link.
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
  return isFailureOutcome(entry.outcome);
}

/** Marks where the tenant's name sits in a sentence; no catalogue line contains it. */
const SLOT = "\u0000";

const NARRATED_EVENTS = new Set([
  "TenantProvisioned",
  "InvitationResent",
  "InvitationRevoked",
  "InvitationReplaced",
  "InvitationReissued",
  "BootstrapCompleted",
  "ActivationRejected",
  "TenantDeactivated",
  "TenantReactivated",
  "TenantProfileChanged",
  "TenantArchived",
  "ProductEnabled",
  "ProductDisabled",
]);

export function activityNarrative(
  entry: TenantActivityEntry,
  words: TenantWords = tenantWords()
): ActivityNarrative {
  // The title is shared with the tenant record's timeline; only the sentence
  // around the tenant name belongs to this feed.
  const isFailed = failed(entry);
  const title = words.eventTitle(entry.eventType, isFailed);

  const key =
    entry.eventType === "InvitationDeliveryAttempted"
      ? isFailed
        ? "deliveryFailed"
        : "deliverySent"
      : NARRATED_EVENTS.has(entry.eventType)
        ? entry.eventType
        : // An event this build has no wording for is still real. It reports the
          // tenant and the outcome rather than disappearing from the history.
          "unknown";

  const [before = "", after = ""] = words
    .say(`narrative.${key}`, { tenant: SLOT })
    .split(SLOT);

  // The business specification already calls these rejected activation
  // attempts, so they read as failures whatever the stored outcome says.
  const isFailure =
    entry.eventType === "ActivationRejected" ||
    (entry.eventType === "InvitationDeliveryAttempted" || key === "unknown"
      ? isFailed
      : false);

  return { title, before, after, isFailure };
}

/**
 * Recent moments read better as "Today at 10:42" than as a date, but only while
 * "today" is still unambiguous. Beyond yesterday it falls back to the date, and
 * the exact timestamp is always available to assistive technology through the
 * element's `dateTime` and title.
 */
export function activityTimestamp(
  occurredAt: string,
  now: Date = new Date(),
  words: TenantWords = tenantWords()
): string {
  const at = new Date(occurredAt);

  const time = formatDateParts(
    at,
    {
      hour: "numeric",
      minute: "2-digit",
    },
    undefined,
    words.locale
  );

  const days = calendarDaysBetween(at, now);

  if (days === 0) return words.say("timestamp.today", { time });
  if (days === 1) return words.say("timestamp.yesterday", { time });

  return formatDateParts(
    at,
    {
      day: "numeric",
      month: "short",
      year: at.getFullYear() === now.getFullYear() ? undefined : "numeric",
    },
    undefined,
    words.locale
  );
}

/** Whole calendar days apart, so 23:59 and 00:01 are "yesterday", not "today". */
function calendarDaysBetween(from: Date, to: Date): number {
  const a = new Date(from.getFullYear(), from.getMonth(), from.getDate());
  const b = new Date(to.getFullYear(), to.getMonth(), to.getDate());
  return Math.round((b.getTime() - a.getTime()) / 86_400_000);
}

export function activityActor(
  entry: TenantActivityEntry,
  words: TenantWords = tenantWords()
): string {
  return words.eventActor(entry.actorName);
}
