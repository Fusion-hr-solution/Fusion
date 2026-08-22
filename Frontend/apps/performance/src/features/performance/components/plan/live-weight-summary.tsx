"use client";

import { Check } from "lucide-react";
import type { PlanObjectiveDto, PlanReadinessDto } from "@repo/api";
import { AsyncButton } from "@repo/ds/shell";
import { cn } from "@repo/ds/lib/utils";
import { pct, weightTone } from "./plan-lib";

const SEGMENT_COLORS = [
  "bg-primary",
  "bg-sky-500",
  "bg-violet-500",
  "bg-amber-500",
  "bg-emerald-500",
  "bg-rose-500",
];

/**
 * The Live Weight Summary — the always-visible readout of how a plan's weights add up to 100%.
 * A single segmented meter shows each objective's share proportionally; the total leads with a
 * large numeral and a plain readiness line (ready, still to assign, or over). It replaces a
 * validation error with a continuous, legible constraint so an invalid total is understood before
 * Submit is ever pressed.
 */
export function LiveWeightSummary({
  objectives,
  readiness,
  canSubmit,
  onSubmit,
  submitting,
}: {
  objectives: PlanObjectiveDto[];
  readiness: PlanReadinessDto;
  canSubmit: boolean;
  onSubmit: () => void;
  submitting: boolean;
}) {
  const total = readiness.weightTotal;
  const tone = weightTone(total);
  const remaining = readiness.weightRemaining;

  const message =
    total === 100
      ? "Ready to submit"
      : remaining > 0
        ? `${pct(remaining)}% still to assign`
        : `Over by ${pct(-remaining)}%`;

  return (
    <section className="rounded-2xl border bg-card p-5">
      <div className="flex items-end justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">Plan weight</p>
          <div className="mt-1 flex items-baseline gap-2">
            <span
              className={cn(
                "text-4xl font-semibold tabular-nums tracking-tight",
                tone === "success" ? "text-success" : tone === "danger" ? "text-destructive" : "text-foreground"
              )}
            >
              {pct(total)}%
            </span>
            <span className={cn("text-sm font-medium", tone === "success" ? "text-success" : "text-muted-foreground")}>
              {tone === "success" ? (
                <span className="inline-flex items-center gap-1">
                  <Check className="size-4" aria-hidden /> {message}
                </span>
              ) : (
                message
              )}
            </span>
          </div>
        </div>
        {onSubmit ? (
          <AsyncButton pending={submitting} disabled={!canSubmit} onClick={onSubmit}>
            Submit plan
          </AsyncButton>
        ) : null}
      </div>

      {/* Segmented meter — each objective's proportional share, plus any unassigned remainder. */}
      <div className="mt-4 flex h-2.5 w-full overflow-hidden rounded-full bg-muted" role="img" aria-label={`Plan weight ${pct(total)} percent of 100`}>
        {objectives.map((objective, index) => {
          const weight = objective.planWeight ?? 0;
          if (weight <= 0) return null;
          return (
            <span
              key={objective.id}
              className={cn(SEGMENT_COLORS[index % SEGMENT_COLORS.length], "h-full")}
              style={{ width: `${Math.min(weight, 100)}%` }}
              title={`${objective.title} · ${pct(weight)}%`}
            />
          );
        })}
      </div>

      {readiness.blockers.length > 0 ? (
        <ul className="mt-3 space-y-1">
          {readiness.blockers.map((blocker) => (
            <li key={blocker} className="text-sm text-muted-foreground">
              {blocker}
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}
