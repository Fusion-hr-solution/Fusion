"use client";

import type { ReactNode } from "react";
import { CalendarRange } from "lucide-react";
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

/**
 * The persistent, quiet Cycle context every Performance route sits inside — which
 * Cycle, its state, its horizon, and its planning deadline. Deliberately secondary:
 * it orients without competing with the page title beneath it, so "which Cycle" and
 * "what page" never carry the same visual weight.
 */
export function CycleContextBar({
  cycle,
  action,
  showPlanningDeadline = true,
  className,
}: {
  cycle: CycleSummaryDto;
  /** Optional trailing control (e.g. an edit affordance), pushed to the far right. */
  action?: ReactNode;
  /**
   * Whether to show the planning deadline. Once a surface has moved past planning (e.g. an approved,
   * locked plan under execution), the deadline is stale guidance — the caller drops it rather than
   * showing a passed date as if it still mattered.
   */
  showPlanningDeadline?: boolean;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "mb-5 flex flex-wrap items-center gap-x-2.5 gap-y-1 rounded-xl border border-border bg-transparent px-4 py-2.5 text-sm",
        className
      )}
    >
      <span className="font-medium text-foreground">{cycle.name}</span>
      <StatusBadge tone={STATE_TONE[cycle.state]} dot>
        {STATE_LABEL[cycle.state]}
      </StatusBadge>
      <span aria-hidden className="text-border">|</span>
      <span className="inline-flex items-center gap-1.5 text-muted-foreground">
        <CalendarRange className="size-3.5" aria-hidden />
        {formatDateRange(cycle.startDate, cycle.endDate)}
      </span>
      {showPlanningDeadline ? (
        <>
          <span aria-hidden className="text-border">|</span>
          <span className="text-muted-foreground">
            Planning by{" "}
            <span className="text-foreground/80">{formatDate(cycle.planningDeadline)}</span>
          </span>
        </>
      ) : null}
      {action ? <div className="ml-auto">{action}</div> : null}
    </div>
  );
}
