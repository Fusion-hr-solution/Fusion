"use client";

import type { ReactNode } from "react";
import { ArrowDown, CalendarClock } from "lucide-react";
import { cn } from "@repo/ds";
import { formatWorkforceDate } from "./workforce-ui";

/**
 * The effective date is not a technical field at the bottom of a form — it changes
 * the meaning of the whole action, so it leads the task and its language shifts
 * between "today" and a scheduled future date.
 */
export function EffectiveDateField({
  value,
  min,
  onChange,
  isFuture,
  label = "Effective date",
}: {
  value: string;
  min?: string;
  onChange: (value: string) => void;
  isFuture: boolean;
  label?: string;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 rounded-xl border bg-card px-4 py-3">
      <label className="inline-flex items-center gap-2.5">
        <CalendarClock className={cn("size-4", isFuture ? "text-primary" : "text-muted-foreground")} aria-hidden />
        <span className="type-label">{label}</span>
        <input
          type="date"
          value={value}
          min={min}
          onChange={(event) => onChange(event.target.value)}
          className="rounded-md border bg-background px-2.5 py-1.5 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring [color-scheme:light] dark:[color-scheme:dark]"
          aria-label={label}
        />
      </label>
      <span className={cn("type-meta", isFuture ? "font-medium text-foreground" : "text-muted-foreground")}>
        {isFuture ? `Scheduled — takes effect ${formatWorkforceDate(value, { month: "long" })}` : "Takes effect today"}
      </span>
    </div>
  );
}

/**
 * The resulting-state preview: the signature of a workforce task. It shows the
 * consequence of the action — the current state above, the state after the
 * effective date below — so the user sees what will be true, not just what they
 * typed. Unchanged facts stay quiet; changed facts carry weight.
 */
export function ConsequencePanel({
  effectiveDate,
  isFuture,
  now,
  after,
  afterTone = "primary",
  pending,
}: {
  effectiveDate: string;
  isFuture: boolean;
  now: ReactNode;
  after: ReactNode;
  afterTone?: "primary" | "destructive";
  /** True before the user has changed anything — the after block reads as a preview, not a promise. */
  pending?: boolean;
}) {
  const accent = afterTone === "destructive" ? "text-destructive" : "text-primary";
  const ring =
    afterTone === "destructive"
      ? "ring-destructive/20 bg-destructive/[0.03]"
      : "ring-primary/25 bg-primary/[0.04]";
  return (
    <div className="overflow-hidden rounded-2xl border bg-card">
      <div className="border-b px-5 py-3.5">
        <p className="type-eyebrow text-muted-foreground">Now</p>
        <div className="mt-2.5">{now}</div>
      </div>
      <div className="grid place-items-center py-1.5" aria-hidden>
        <ArrowDown className="size-4 text-muted-foreground/60" />
      </div>
      <div className={cn("px-5 py-4 ring-1 ring-inset", pending ? "bg-muted/30 ring-transparent" : ring)}>
        <p className={cn("type-eyebrow", pending ? "text-muted-foreground" : accent)}>
          {isFuture ? `After ${formatWorkforceDate(effectiveDate, { month: "long" })}` : "After this change"}
        </p>
        <div className={cn("mt-2.5", pending && "text-muted-foreground")}>{after}</div>
      </div>
    </div>
  );
}

/** A labeled fact inside a consequence block. Changed facts read at full weight. */
export function PreviewFact({
  label,
  children,
  changed,
  muted,
}: {
  label?: string;
  children: ReactNode;
  changed?: boolean;
  muted?: boolean;
}) {
  return (
    <div className="min-w-0">
      {label ? <p className="type-meta text-muted-foreground">{label}</p> : null}
      <p className={cn("type-body", changed ? "font-medium text-foreground" : muted ? "text-muted-foreground" : "text-foreground")}>
        {children}
      </p>
    </div>
  );
}
