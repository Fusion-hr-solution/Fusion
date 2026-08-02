"use client";

import Link from "next/link";
import {
  Ban,
  Building2,
  CircleSlash,
  MailCheck,
  MailX,
  RefreshCw,
  ScrollText,
  Send,
  UserCheck,
  UserPen,
  type LucideIcon,
} from "lucide-react";
import { Button } from "@repo/ds/components/ui/button";
import { Skeleton } from "@repo/ds/components/ui/skeleton";
import { cn } from "@repo/ds/lib/utils";
import type { TenantActivityEntry } from "../api";
import { ACTIVITY_PREVIEW_LIMIT, failureKind } from "../api";
import { NOT_CONNECTED, UnavailableAction } from "../availability";
import { useTenantActivity } from "../queries";
import {
  activityActor,
  activityNarrative,
  activityTimestamp,
} from "./tenant-activity-language";

/**
 * A short preview of what has recently happened across the estate.
 *
 * It sits under the directory because it is context, not work: the directory
 * answers "what needs me?", and this answers "what just happened?". That
 * ordering is why it stays a compact pair of columns rather than a second table
 * — a full log belongs on its own page, and duplicating the directory's weight
 * here would leave the page with two things competing to be the main one.
 *
 * No action lives on a card. Recovery belongs to the tenant record and the
 * directory's row menu, and offering it in three places would make it unclear
 * which one is authoritative.
 */

const EVENT_ICON: Record<string, LucideIcon> = {
  TenantProvisioned: Building2,
  InvitationResent: Send,
  InvitationRevoked: Ban,
  InvitationReplaced: UserPen,
  InvitationReissued: RefreshCw,
  BootstrapCompleted: UserCheck,
  ActivationRejected: CircleSlash,
};

function iconFor(entry: TenantActivityEntry): LucideIcon {
  if (entry.eventType === "InvitationDeliveryAttempted") {
    // The same record is a sent invitation or a bounced one, so the glyph has
    // to follow the outcome rather than the event name.
    return entry.outcome.toLowerCase() === "succeeded" ? MailCheck : MailX;
  }

  return EVENT_ICON[entry.eventType] ?? ScrollText;
}

export function TenantActivitySection() {
  const { data, error, isLoading, refetch } = useTenantActivity();
  const entries = data ?? [];

  return (
    <section className="mt-6">
      <header className="mb-3 flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-sm font-semibold text-foreground">
            Recent tenant activity
          </h2>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Latest provisioning and administrator-activation events across customer
            tenants.
          </p>
        </div>

        <UnavailableAction
          label="View full audit log"
          icon={ScrollText}
          explanation={NOT_CONNECTED}
          variant="ghost"
        />
      </header>

      {isLoading ? <ActivitySkeleton /> : null}

      {!isLoading && error ? (
        <ActivityFailure error={error} onRetry={refetch} />
      ) : null}

      {!isLoading && !error && entries.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border px-4 py-6 text-center text-sm text-muted-foreground">
          No tenant activity has been recorded yet.
        </p>
      ) : null}

      {!isLoading && !error && entries.length > 0 ? (
        <ul className="grid gap-2 md:grid-cols-2">
          {entries.map((entry) => (
            <ActivityCard
              key={`${entry.tenantId}-${entry.occurredAt}-${entry.eventType}`}
              entry={entry}
            />
          ))}
        </ul>
      ) : null}
    </section>
  );
}

function ActivityCard({ entry }: { entry: TenantActivityEntry }) {
  const narrative = activityNarrative(entry);
  const Icon = iconFor(entry);

  return (
    <li className="flex items-start gap-3 rounded-xl border border-border bg-card p-3.5">
      <span
        className={cn(
          "flex size-8 shrink-0 items-center justify-center rounded-lg",
          narrative.isFailure
            ? "bg-destructive/12 text-destructive"
            : "bg-muted text-muted-foreground"
        )}
      >
        <Icon aria-hidden="true" className="size-4" />
      </span>

      <div className="min-w-0 flex-1">
        {/* The title carries the meaning in words, so a failure is never
            identified by its red tint alone. */}
        <p
          className={cn(
            "truncate text-sm font-medium",
            narrative.isFailure ? "text-destructive" : "text-foreground"
          )}
        >
          {narrative.title}
        </p>

        <p className="mt-0.5 text-sm text-muted-foreground">
          {narrative.before}
          <Link
            href={`/tenants/${entry.tenantId}`}
            className="font-medium text-foreground no-underline visited:text-foreground hover:text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
          >
            {entry.tenantName}
          </Link>
          {narrative.after}
        </p>

        <p className="mt-1.5 flex items-center gap-1.5 text-xs text-muted-foreground">
          {/* The rendered form is relative for recent events; the exact moment
              stays available to assistive technology and on hover. */}
          <time dateTime={entry.occurredAt} title={new Date(entry.occurredAt).toLocaleString()}>
            {activityTimestamp(entry.occurredAt)}
          </time>
          <span aria-hidden="true">·</span>
          <span className="truncate">{activityActor(entry)}</span>
        </p>
      </div>
    </li>
  );
}

/** Card-shaped while it loads, so the section does not collapse and rebuild. */
function ActivitySkeleton() {
  return (
    <ul aria-busy aria-label="Loading recent tenant activity" className="grid gap-2 md:grid-cols-2">
      {Array.from({ length: ACTIVITY_PREVIEW_LIMIT }).map((_, index) => (
        <li
          key={index}
          className="flex items-start gap-3 rounded-xl border border-border bg-card p-3.5"
        >
          <Skeleton className="size-8 shrink-0 rounded-lg" />
          <div className="min-w-0 flex-1 space-y-1.5">
            <Skeleton className="h-4 w-32 max-w-full" />
            <Skeleton className="h-4 w-52 max-w-full" />
            <Skeleton className="h-3 w-40 max-w-full" />
          </div>
        </li>
      ))}
    </ul>
  );
}

/** An unavailable feed is not the same answer as a quiet one. */
function ActivityFailure({
  error,
  onRetry,
}: {
  error: Error;
  onRetry: () => void;
}) {
  const kind = failureKind(error);

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-card px-4 py-3">
      <p className="text-sm text-muted-foreground">
        {kind === "permission"
          ? "Your Platform administration access has changed."
          : "Recent activity could not be loaded."}
      </p>
      {kind === "permission" ? null : (
        <Button variant="outline" size="sm" onClick={onRetry}>
          Retry
        </Button>
      )}
    </div>
  );
}
