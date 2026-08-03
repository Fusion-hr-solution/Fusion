"use client";

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
import { cn } from "@repo/ds/lib/utils";
import type { TenantHistoryEntry } from "../api";
import { eventActor, eventTitle, formatDateTime, isFailureOutcome } from "../language";

/** Titles come from `language.ts`; only the glyph is chosen here. */
const EVENT_ICON: Record<string, LucideIcon> = {
  TenantProvisioned: Building2,
  InvitationSent: MailCheck,
  InvitationDeliveryFailed: MailX,
  InvitationResent: Send,
  InvitationRevoked: Ban,
  InvitationReplaced: UserPen,
  InvitationReissued: RefreshCw,
  BootstrapCompleted: UserCheck,
  ActivationRejected: CircleSlash,
};

/**
 * What has happened to this tenant, as a timeline rather than a table.
 *
 * The stored vocabulary is domain language — `InvitationDeliveryAttempted`,
 * `BootstrapCompleted` — and putting it on screen would make the reader
 * translate. Each entry resolves to a short sentence in the product's own
 * words, with the person who caused it and the moment it happened.
 */

interface DescribedEvent {
  title: string;
  icon: LucideIcon;
  isFailure: boolean;
}

export function describeEvent(entry: TenantHistoryEntry): DescribedEvent {
  const failed = isFailureOutcome(entry.outcome);
  const title = eventTitle(entry.eventType, failed);

  return {
    title,
    icon: EVENT_ICON[entry.eventType === "InvitationDeliveryAttempted"
      ? failed ? "InvitationDeliveryFailed" : "InvitationSent"
      : entry.eventType] ?? ScrollText,
    // A delivery that bounced and a rejected activation are the two events the
    // platform has to answer for; the rest are simply what happened.
    isFailure:
      failed &&
      (entry.eventType === "InvitationDeliveryAttempted" ||
        entry.eventType === "ActivationRejected"),
  };
}

export function EventTimeline({
  entries,
  id,
}: {
  entries: readonly TenantHistoryEntry[];
  id?: string;
}) {
  return (
    <ol id={id}>
      {entries.map((entry, index) => {
        const { title, icon: Icon, isFailure } = describeEvent(entry);
        const isLast = index === entries.length - 1;

        return (
          <li
            key={`${entry.eventType}-${entry.occurredAt}-${index}`}
            className="relative flex gap-3 pb-4 last:pb-0"
          >
            {/* The rail joins the markers and stops at the last one, so the
                timeline does not appear to continue past what it shows. */}
            {!isLast ? (
              <span
                aria-hidden="true"
                className="absolute bottom-0 left-[13px] top-7 w-px bg-border"
              />
            ) : null}

            <span
              className={cn(
                "relative z-10 flex size-7 shrink-0 items-center justify-center rounded-full",
                isFailure
                  ? "bg-destructive/12 text-destructive"
                  : "bg-muted text-muted-foreground"
              )}
            >
              <Icon aria-hidden="true" className="size-3.5" />
            </span>

            <div className="min-w-0 flex-1 pt-0.5">
              <p
                className={cn(
                  "text-sm",
                  isFailure ? "font-medium text-destructive" : "text-foreground"
                )}
              >
                {title}
              </p>
              <p className="mt-0.5 flex flex-wrap items-center gap-x-1.5 text-xs text-muted-foreground">
                <time dateTime={entry.occurredAt}>
                  {formatDateTime(entry.occurredAt)}
                </time>
                <span aria-hidden="true">·</span>
                <span>{eventActor(entry.actorName)}</span>
              </p>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
