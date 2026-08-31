"use client";

import { CalendarDays } from "lucide-react";
import { cn } from "@repo/ds";
import { formatHumanDate } from "@/features/organization-import/model/format";
import {
  importDateMeaning,
  type ImportDateConfig,
} from "../model/import-descriptor";

const MEANING_LABEL: Record<string, string> = {
  today: "Today",
  scheduled: "Scheduled",
  past: "Past-dated",
};

/**
 * The as-of date as first-class business context, not an advanced setting. The native
 * field stays present (directly editable, no reveal toggle), the meaning of the chosen
 * date reads inline, and the consequence — or, for workforce, the refusal of a future
 * date — is stated plainly beneath rather than buried in a tooltip.
 */
export function ImportDateControl({
  config,
  value,
  onChange,
  today,
}: {
  config: ImportDateConfig;
  value: string;
  onChange: (value: string) => void;
  today: string;
}) {
  const valid = /^\d{4}-\d{2}-\d{2}$/.test(value);
  const meaning = importDateMeaning(value, today);
  const isFutureRefused = !config.allowFuture && meaning === "scheduled";

  return (
    <div className="min-w-0">
      <div className="flex items-center gap-3">
        <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
          <CalendarDays className="size-[1.15rem]" aria-hidden />
        </span>
        <div className="min-w-0">
          <label
            htmlFor={config.inputId}
            className="type-meta font-medium uppercase tracking-wide text-muted-foreground"
          >
            {config.label}
          </label>
          <div className="mt-1 flex flex-wrap items-center gap-x-2.5 gap-y-1">
            <input
              id={config.inputId}
              type="date"
              value={value}
              max={config.allowFuture ? undefined : today}
              onChange={(event) => onChange(event.target.value)}
              className="rounded-lg border border-input bg-background px-2.5 py-1 type-label font-semibold text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
            {valid ? (
              <span
                className={cn(
                  "type-meta font-medium",
                  isFutureRefused ? "text-warning" : "text-muted-foreground"
                )}
              >
                {MEANING_LABEL[meaning]}
              </span>
            ) : null}
          </div>
        </div>
      </div>

      {valid && isFutureRefused && config.futureRefusal ? (
        <p className="mt-2 max-w-md type-meta text-warning">{config.futureRefusal}</p>
      ) : valid && meaning !== "today" ? (
        <p className="mt-2 max-w-md type-meta text-muted-foreground">
          {config.consequence(formatHumanDate(value), meaning)}
        </p>
      ) : null}
    </div>
  );
}
