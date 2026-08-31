"use client";

import { Check } from "lucide-react";
import type { PlanReadinessDto } from "@repo/api";
import { AsyncButton } from "@repo/ds/shell";
import { cn } from "@repo/ds/lib/utils";
import { pct, weightTone } from "./plan-lib";

/**
 * The always-visible readout of how a plan's weights add up to 100%. One meter shows the
 * allocated share filling toward the target and any over-allocation; the total leads with a
 * large numeral and a plain readiness line. It replaces a validation error with a continuous,
 * legible constraint so an invalid total is understood before Submit is pressed. The per-objective
 * weights live in the ledger above — this is the sum, not a second colour legend.
 */
export function LiveWeightSummary({
  readiness,
  canSubmit,
  onSubmit,
  submitting,
  submitLabel = "Submit plan",
}: {
  readiness: PlanReadinessDto;
  canSubmit: boolean;
  onSubmit: () => void;
  submitting: boolean;
  submitLabel?: string;
}) {
  const total = readiness.weightTotal;
  const tone = weightTone(total);
  const remaining = readiness.weightRemaining;
  const over = total > 100;

  const message =
    total === 100
      ? "Ready to submit"
      : remaining > 0
        ? `${pct(remaining)}% still to assign`
        : `Over by ${pct(-remaining)}%`;

  return (
    <section className="rounded-2xl border border-border bg-card p-5">
      <div className="flex items-end justify-between gap-4">
        <div>
          <p className="type-eyebrow text-muted-foreground">Plan weight</p>
          <div className="mt-1 flex items-baseline gap-2">
            <span
              className={cn(
                "type-metric",
                tone === "success" ? "text-success" : tone === "danger" ? "text-destructive" : "text-foreground"
              )}
            >
              {pct(total)}%
            </span>
            <span
              className={cn(
                "text-sm font-medium",
                tone === "success" ? "text-success" : tone === "danger" ? "text-destructive" : "text-muted-foreground"
              )}
            >
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
            {submitLabel}
          </AsyncButton>
        ) : null}
      </div>

      {/* One meter: allocation toward 100%. Over-allocation shows a destructive overflow cap. */}
      <div
        className="mt-4 h-2.5 w-full overflow-hidden rounded-full bg-muted"
        role="img"
        aria-label={`Plan weight ${pct(total)} percent of 100`}
      >
        <span
          className={cn(
            "block h-full rounded-full transition-[width]",
            over ? "bg-destructive" : tone === "success" ? "bg-success" : "bg-primary"
          )}
          style={{ width: `${Math.min(total, 100)}%` }}
        />
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
