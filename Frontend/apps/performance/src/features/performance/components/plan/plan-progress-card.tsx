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
            height={160}
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
        <ObjectiveProgressRing plan={plan} complete={complete} />
        <p className="mt-3 text-xs text-muted-foreground">Weighted across {plan.objectives.length} objectives</p>
      </div>

    </SidebarSection>
  );
}

const RING = 160;
const STROKE = 13;
const GAP = 3; // px of track between adjacent segments

/**
 * Plan progress as each objective's share of it: one arc per objective, sized by what it contributes
 * (its progress, capped at 100%, times its plan weight — the same sum as `plan.planProgress`) and
 * coloured by its type, amber when aligned and blue when standalone, matching its row.
 */
function ObjectiveProgressRing({ plan, complete }: { plan: EmployeePlanDto; complete: boolean }) {
  const r = (RING - STROKE) / 2;
  const c = 2 * Math.PI * r;
  let offset = 0;
  const segments = plan.objectives
    .map((o) => ({
      id: o.id,
      aligned: o.isAligned,
      share: o.hasProgress ? (Math.min(o.derivedProgress, 100) * (o.planWeight ?? 0)) / 100 : 0,
    }))
    .filter((s) => s.share > 0)
    .map((s) => {
      const length = (s.share / 100) * c;
      const seg = { ...s, start: offset, length };
      offset += length;
      return seg;
    });

  return (
    <div className="relative" style={{ width: RING, height: RING }}>
      <svg width={RING} height={RING} viewBox={`0 0 ${RING} ${RING}`} className="-rotate-90" aria-hidden>
        <circle cx={RING / 2} cy={RING / 2} r={r} fill="none" strokeWidth={STROKE} className="stroke-muted" />
        {segments.map((s) => {
          const visible = Math.max(s.length - (segments.length > 1 ? GAP : 0), 1);
          return (
            <circle
              key={s.id}
              cx={RING / 2}
              cy={RING / 2}
              r={r}
              fill="none"
              strokeWidth={STROKE}
              strokeLinecap="butt"
              strokeDasharray={`${visible} ${c - visible}`}
              strokeDashoffset={-s.start}
              className={s.aligned ? "stroke-primary" : "stroke-info"}
            />
          );
        })}
      </svg>
      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
        <span className={cn("text-2xl font-semibold leading-none tabular-nums", complete ? "text-success" : "text-foreground")}>
          {progressPct(plan.planProgress)}%
        </span>
        <span className="mt-1.5 text-xs text-muted-foreground">overall progress</span>
      </div>
    </div>
  );
}
