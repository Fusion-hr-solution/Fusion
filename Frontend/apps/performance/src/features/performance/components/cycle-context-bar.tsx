"use client";

import { CalendarRange } from "@/lib/icons";
import type { CycleSummaryDto } from "@repo/api";
import { StatusBadge, type StatusTone } from "@repo/ds/shell";
import { cn } from "@repo/ds/lib/utils";
import { formatDate, formatDateRange } from "../lib";

const STATE_TONE: Record<CycleSummaryDto["state"], StatusTone> = {
  Draft: "info",
  Active: "success",
  Closed: "muted",
};

const STATE_LABEL: Record<CycleSummaryDto["state"], string> = {
  Draft: "In setup",
  Active: "Active",
  Closed: "Closed",
};

/** Today as a `YYYY-MM-DD` local date, comparable with DateOnly strings from the API. */
function todayIso(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/**
 * The persistent Cycle context every Performance route sits inside — which Cycle, its state, its
 * horizon, and (while it still matters) its planning deadline. Rendered once in the module top bar,
 * a single quiet line that orients without competing with the page title. On narrow widths it
 * collapses to identity and state.
 */
export function CycleContextBar({ cycle, className }: { cycle: CycleSummaryDto; className?: string }) {
  // The planning deadline is guidance only while planning is still open; once it has passed (or the
  // Cycle is not running) it drops out rather than showing a stale date.
  const showPlanningDeadline = cycle.state === "Active" && cycle.planningDeadline >= todayIso();

  return (
    <div className={cn("flex min-w-0 items-center gap-x-2.5 text-sm", className)}>
      <span className="truncate font-medium text-foreground">{cycle.name}</span>
      <StatusBadge tone={STATE_TONE[cycle.state]} dot className="shrink-0">
        {STATE_LABEL[cycle.state]}
      </StatusBadge>
      <span aria-hidden className="hidden text-border md:inline">|</span>
      <span className="hidden shrink-0 items-center gap-1.5 text-muted-foreground md:inline-flex">
        <CalendarRange className="size-3.5" aria-hidden />
        {formatDateRange(cycle.startDate, cycle.endDate)}
      </span>
      {showPlanningDeadline ? (
        <>
          <span aria-hidden className="hidden text-border lg:inline">|</span>
          <span className="hidden shrink-0 text-muted-foreground lg:inline">
            Planning by <span className="text-foreground/80">{formatDate(cycle.planningDeadline)}</span>
          </span>
        </>
      ) : null}
    </div>
  );
}
