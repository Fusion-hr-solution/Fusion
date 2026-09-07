"use client";

import type { EmployeePlanDto } from "@repo/api";
import { AllocationGauge } from "@repo/ds/shell";
import { cn } from "@repo/ds/lib/utils";
import { PROGRESS_TONE_BG, objectiveProgressTone, progressPct } from "./plan-lib";

/**
 * The canonical weighted Plan-progress read — one presentation over one calculation (`plan.planProgress`),
 * shared by the employee's own plan and the manager's read of it so both see the same figure and breakdown.
 * Before any objective is updated it holds an empty ring and says so honestly — missing is not 0%. Once
 * progress exists it shows the derived weighted figure over a per-objective breakdown (number, title, its
 * own progress), so the headline number is always explained by the objectives beneath it. Colour stays
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
      <section className="rounded-2xl border border-border bg-card p-5">
        <p className="type-eyebrow text-muted-foreground">Plan progress</p>
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
      </section>
    );
  }

  return (
    <section className="rounded-2xl border border-border bg-card p-5">
      <p className="type-eyebrow text-muted-foreground">Plan progress</p>
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

      <ul className="mt-5 space-y-3 border-t border-border pt-4">
        {plan.objectives.map((objective, index) => {
          const tone = objectiveProgressTone(objective.isAligned, objective.derivedProgress);
          return (
            <li key={objective.id} className="flex items-center gap-3">
              <span className="flex size-6 shrink-0 items-center justify-center rounded-md border border-border bg-muted/50 text-[0.6875rem] font-semibold tabular-nums text-muted-foreground">
                {String(index + 1).padStart(2, "0")}
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <p className="min-w-0 truncate text-xs font-medium text-foreground">{objective.title}</p>
                  <span
                    className={cn(
                      "shrink-0 text-xs font-semibold tabular-nums",
                      objective.hasProgress ? "text-foreground" : "text-muted-foreground/50"
                    )}
                  >
                    {objective.hasProgress ? `${progressPct(objective.derivedProgress)}%` : "—"}
                  </span>
                </div>
                <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-muted">
                  {objective.hasProgress ? (
                    <span
                      className={cn("block h-full rounded-full", PROGRESS_TONE_BG[tone])}
                      style={{ width: `${Math.min(objective.derivedProgress, 100)}%` }}
                    />
                  ) : null}
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
