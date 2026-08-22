"use client";

import { Check } from "lucide-react";
import type { MilestoneStateDto } from "@repo/api";
import { cn } from "@repo/ds/lib/utils";
import { MILESTONE_LABELS } from "../lib";

/**
 * Operational orientation, not lifecycle status. Reached milestones read as done; the current
 * frontier is emphasized; later ones stay quiet. The formal state lives in the header badge.
 */
export function MilestoneRail({ milestones }: { milestones: MilestoneStateDto[] }) {
  const frontier = milestones.findIndex((milestone) => !milestone.reached);

  return (
    <ol className="flex w-full items-start gap-0 overflow-x-auto pb-1" aria-label="Cycle milestones">
      {milestones.map((milestone, index) => {
        const isCurrent = index === frontier;
        const connectorReached = milestone.reached && index < milestones.length - 1;
        return (
          <li key={milestone.milestone} className="flex min-w-0 flex-1 flex-col items-center gap-2 text-center">
            <div className="flex w-full items-center">
              <span className={cn("h-px flex-1", index === 0 ? "bg-transparent" : milestone.reached || isCurrent ? "bg-primary/40" : "bg-border")} />
              <span
                className={cn(
                  "flex size-6 shrink-0 items-center justify-center rounded-full border text-[0.65rem] font-semibold transition-colors",
                  milestone.reached
                    ? "border-primary bg-primary text-primary-foreground"
                    : isCurrent
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border bg-muted/40 text-muted-foreground"
                )}
              >
                {milestone.reached ? <Check className="size-3.5" aria-hidden /> : index + 1}
              </span>
              <span className={cn("h-px flex-1", connectorReached ? "bg-primary/40" : "bg-border", index === milestones.length - 1 && "bg-transparent")} />
            </div>
            <span
              className={cn(
                "px-1 text-[0.7rem] leading-tight",
                milestone.reached ? "text-foreground" : isCurrent ? "font-medium text-foreground" : "text-muted-foreground"
              )}
            >
              {MILESTONE_LABELS[milestone.milestone]}
            </span>
          </li>
        );
      })}
    </ol>
  );
}
