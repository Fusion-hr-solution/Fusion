"use client";

import type { ReactNode } from "react";
import {
  AlarmClock,
  CalendarCheck2,
  CalendarClock,
  CircleSlash,
  MessageCircleWarning,
} from "lucide-react";
import type {
  CheckInStatus,
  DiscussionSignalStatus,
  FollowUpActionStatus,
} from "@repo/api";
import { cn } from "@/lib/utils";
import { formatDate } from "@/lib/labels";
import {
  actionStatusLabel,
  checkInStatusLabel,
  signalStatusLabel,
} from "./check-in-terms";

/** Combine a planned date with an optional free-text time into one product-language string. */
export function formatCheckInWhen(date: string, time: string | null): string {
  const day = formatDate(date);
  return time ? `${day} · ${time}` : day;
}

/**
 * Status badge for a check-in. Shape (icon) + word carry the state; colour reinforces it. Overdue is
 * a distinct amber alarm so a slipped check-in reads even without colour.
 */
export function CheckInStatusBadge({
  status,
  isOverdue,
  className,
}: {
  status: CheckInStatus;
  isOverdue: boolean;
  className?: string;
}) {
  const overdue = status === "Planned" && isOverdue;
  const config: { icon: ReactNode; classes: string } = overdue
    ? {
        icon: <AlarmClock className="size-3.5" />,
        classes: "text-amber-700 bg-amber-500/12 dark:text-amber-300",
      }
    : status === "Completed"
      ? {
          icon: <CalendarCheck2 className="size-3.5" />,
          classes: "text-emerald-700 bg-emerald-500/12 dark:text-emerald-300",
        }
      : status === "Cancelled"
        ? {
            icon: <CircleSlash className="size-3.5" />,
            classes: "text-muted-foreground bg-muted",
          }
        : {
            icon: <CalendarClock className="size-3.5" />,
            classes: "text-primary bg-primary/10",
          };

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium",
        config.classes,
        className,
      )}
    >
      {config.icon}
      {checkInStatusLabel(status, isOverdue)}
    </span>
  );
}

/** Follow-up action state — open reads primary, overdue amber, completed calm-green, cancelled muted. */
export function ActionStatusBadge({
  status,
  isOverdue,
  className,
}: {
  status: FollowUpActionStatus;
  isOverdue: boolean;
  className?: string;
}) {
  const overdue = status === "Open" && isOverdue;
  const classes = overdue
    ? "text-amber-700 bg-amber-500/12 dark:text-amber-300"
    : status === "Completed"
      ? "text-emerald-700 bg-emerald-500/12 dark:text-emerald-300"
      : status === "Cancelled"
        ? "text-muted-foreground bg-muted"
        : "text-primary bg-primary/10";

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium",
        classes,
        className,
      )}
    >
      {overdue ? "Overdue" : actionStatusLabel(status)}
    </span>
  );
}

/** Discussion signal marker — a flagged conversation request from the employee. */
export function SignalBadge({
  status,
  className,
}: {
  status: DiscussionSignalStatus;
  className?: string;
}) {
  const classes =
    status === "Open"
      ? "text-amber-700 bg-amber-500/12 dark:text-amber-300"
      : status === "ResolvedByCheckIn"
        ? "text-emerald-700 bg-emerald-500/12 dark:text-emerald-300"
        : "text-muted-foreground bg-muted";

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium",
        classes,
        className,
      )}
    >
      <MessageCircleWarning className="size-3.5" />
      {signalStatusLabel(status)}
    </span>
  );
}
