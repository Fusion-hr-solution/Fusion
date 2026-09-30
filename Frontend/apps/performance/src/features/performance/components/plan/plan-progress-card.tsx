"use client";

import type { EmployeePlanDto } from "@repo/api";
import { AllocationGauge } from "@repo/ds/shell";
import { cn } from "@repo/ds/lib/utils";
import { SidebarSection } from "./plan-layout";
import { progressPct } from "./plan-lib";

/**
 * The canonical weighted Plan-progress read — one presentation over one calculation (`plan.planProgress`),
 * shared by the employee's own plan and the manager's read of it so both see the same figure and breakdown.
 * Before any objective is updated it holds an empty ring and says so honestly — missing is not 0%. Once
 * progress exists it shows the derived weighted figure; the per-objective breakdown is the objective rows
 * themselves, so the sidebar does not restate it. Colour stays
 * non-judgmental. The empty-state hint is caller-supplied: the owner is nudged to update; the manager sees
 * only the neutral fact, with no action that isn't theirs.
 */
export function PlanProgressCard({
  plan,
  emptyDescription,
}: {
  plan: EmployeePlanDto;
  /** Optional line under the empty state — the owner's nudge to begin; omitted for a manager's read. */
  emptyDescription?: string;
}) {
  const anyProgress = plan.objectives.some((o) => o.hasProgress);
  const complete = plan.planProgress >= 100;

  if (!anyProgress) {
    return (
      <SidebarSection label="Plan progress">
        <div className="mt-4 flex flex-col items-center text-center">
          <AllocationGauge
            value={0}
            tone="var(--muted-foreground)"
            centerValue="—"
            centerClassName="text-muted-foreground"
            height={132}
          />
          <p className="mt-4 text-base font-semibold tracking-tight text-foreground">No progress reported yet</p>
          {emptyDescription ? (
            <p className="mt-1 max-w-[16rem] text-xs leading-relaxed text-muted-foreground">{emptyDescription}</p>
          ) : null}
        </div>
      </SidebarSection>
    );
  }

  return (
    <SidebarSection label="Plan progress">
      <div className="mt-4 flex flex-col items-center text-center">
        <AllocationGauge
          value={Math.min(plan.planProgress, 100)}
          tone={complete ? "var(--success)" : "var(--primary)"}
          centerValue={`${progressPct(plan.planProgress)}%`}
          centerLabel="overall progress"
          centerClassName={cn("!text-xl !font-semibold tabular-nums", complete ? "text-success" : "text-foreground")}
          height={132}
        />
        <p className="mt-3 text-xs text-muted-foreground">Weighted across {plan.objectives.length} objectives</p>
      </div>

    </SidebarSection>
  );
}
