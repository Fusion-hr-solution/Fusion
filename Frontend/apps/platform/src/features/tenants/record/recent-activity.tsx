"use client";

import Link from "next/link";
import { Clock } from "lucide-react";
import { cn } from "@repo/ds/lib/utils";
import type { TenantHistoryEntry } from "../api";
import { eventTitle, isFailureOutcome, relativeFromNow } from "../language";
import { destinationHref } from "./record-routes";
import { useTenantRecord } from "./record-shell";

/**
 * Recent activity — a short tail of the tenant's platform-control-plane history.
 *
 * It answers "what just happened?" at a glance and hands off to the Activity
 * destination for the full timeline; it never becomes the log itself. Each entry
 * states what happened and when, drawn from the record's own audit trail rather
 * than assembled here.
 */
const PREVIEW_LIMIT = 4;

export function RecentActivity() {
  const { tenant, query } = useTenantRecord();
  const entries = tenant.history.slice(0, PREVIEW_LIMIT);
  const activityHref = `${destinationHref(tenant.tenantId, "activity")}${query}`;

  return (
    <section className="rounded-2xl border border-border bg-card p-5">
      <header className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <Clock aria-hidden="true" className="size-5 text-muted-foreground" />
          <h3 className="text-sm font-semibold text-foreground">Recent activity</h3>
        </div>
        {entries.length > 0 ? (
          <Link
            href={activityHref}
            className="rounded-sm text-sm font-medium text-primary hover:text-primary/80 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
          >
            View activity
          </Link>
        ) : null}
      </header>

      {entries.length === 0 ? (
        <p className="mt-4 text-sm text-muted-foreground">No activity recorded yet.</p>
      ) : (
        <ol className="mt-4">
          {entries.map((entry, index) => (
            <ActivityRow
              key={`${entry.eventType}-${entry.occurredAt}-${index}`}
              entry={entry}
              last={index === entries.length - 1}
            />
          ))}
        </ol>
      )}
    </section>
  );
}

function ActivityRow({
  entry,
  last,
}: {
  entry: TenantHistoryEntry;
  last: boolean;
}) {
  const failed = isFailureOutcome(entry.outcome);

  return (
    <li className="flex gap-3">
      {/* The rail: a dot per event joined by a continuous line, so the entries
          read as one sequence rather than as separate rows. */}
      <div className="flex flex-col items-center" aria-hidden="true">
        <span
          className={cn(
            "mt-1 size-2.5 shrink-0 rounded-full ring-4 ring-card",
            failed ? "bg-destructive" : "bg-primary"
          )}
        />
        {!last ? <span className="w-px flex-1 bg-border" /> : null}
      </div>

      <div className={cn("min-w-0 flex-1", last ? "" : "pb-5")}>
        <div className="flex items-baseline justify-between gap-3">
          <p
            className={cn(
              "min-w-0 truncate text-sm font-medium",
              failed ? "text-destructive" : "text-foreground"
            )}
          >
            {eventTitle(entry.eventType, failed)}
          </p>
          <time
            dateTime={entry.occurredAt}
            title={new Date(entry.occurredAt).toLocaleString()}
            className="shrink-0 text-xs text-muted-foreground"
          >
            {relativeFromNow(entry.occurredAt)}
          </time>
        </div>
        <p className="mt-0.5 text-sm text-muted-foreground">
          {describe(entry.eventType, failed)}
        </p>
      </div>
    </li>
  );
}

/**
 * One truthful line per event kind. It states what the event means for the
 * tenant — not fabricated specifics the audit record does not carry (a
 * recipient's name, a module list), which would be invention dressed as detail.
 */
function describe(eventType: string, failed: boolean): string {
  switch (eventType) {
    case "TenantProvisioned":
      return "Tenant created and configuration completed.";
    case "InvitationDeliveryAttempted":
      return failed
        ? "The administrator invitation could not be delivered."
        : "The administrator invitation was sent.";
    case "InvitationResent":
      return "The administrator invitation was sent again.";
    case "InvitationRevoked":
      return "The administrator invitation was revoked.";
    case "InvitationReplaced":
      return "The nominated administrator was replaced.";
    case "InvitationReissued":
      return "A new administrator invitation was issued.";
    case "BootstrapCompleted":
      return "The administrator completed activation.";
    case "ActivationRejected":
      return "An activation attempt was rejected.";
    case "TenantDeactivated":
      return "Customer access was disabled.";
    case "TenantReactivated":
      return "Customer access was restored.";
    case "TenantProfileChanged":
      return "The tenant profile was updated.";
    default:
      return failed ? "The update did not complete." : "An update was recorded.";
  }
}
