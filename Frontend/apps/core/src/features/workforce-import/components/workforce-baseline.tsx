"use client";

import { useState } from "react";
import { cn } from "@repo/ds";
import { CalendarDays } from "lucide-react";
import { formatWorkforceDate } from "@/features/people/components/workforce-ui";

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

/**
 * Workforce-as-of date as business context, not an advanced setting. Defaults to Today,
 * reads inline, and states the carry-forward consequence plainly when a past date is chosen
 * (never buried in a tooltip). A future date is refused with direction to Hire.
 */
export function BaselineControl({
  value,
  onChange,
  compact = false,
}: {
  value: string;
  onChange: (date: string) => void;
  compact?: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const today = todayIso();
  const isToday = value === today;
  const isFuture = value > today;

  if (compact) {
    return (
      <span className="inline-flex items-center gap-1.5 type-meta text-muted-foreground">
        <CalendarDays className="size-3.5" aria-hidden />
        Workforce as of <span className="font-medium text-foreground">{formatWorkforceDate(value)}</span>
      </span>
    );
  }

  return (
    <div>
      <div className="flex items-center gap-3">
        <span className="grid size-9 place-items-center rounded-object bg-foreground/[0.06] text-muted-foreground">
          <CalendarDays className="size-4" aria-hidden />
        </span>
        <div>
          <p className="type-meta uppercase tracking-wide text-muted-foreground">Workforce as of</p>
          {editing ? (
            <input
              type="date"
              autoFocus
              value={value}
              max={today}
              onChange={(e) => onChange(e.target.value)}
              onBlur={() => setEditing(false)}
              className="mt-0.5 rounded-md border border-input bg-background px-2 py-1 type-label font-semibold text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
          ) : (
            <button
              type="button"
              onClick={() => setEditing(true)}
              className="mt-0.5 flex items-center gap-2 type-label font-semibold text-foreground"
            >
              {isToday ? "Today · " : ""}
              {formatWorkforceDate(value)}
              <span className="type-meta font-medium text-primary underline-offset-4 hover:underline">Change</span>
            </button>
          )}
        </div>
      </div>

      {isFuture ? (
        <p className={cn("mt-2 max-w-md type-meta text-[var(--color-warning)]")}>
          Workforce Import is for people already employed as of the selected date. Use Hire for future employees.
        </p>
      ) : !isToday ? (
        <p className="mt-2 max-w-md type-meta text-muted-foreground">
          Fusion will establish these work details from {formatWorkforceDate(value)} and treat them as current
          until you record a later change.
        </p>
      ) : null}
    </div>
  );
}
