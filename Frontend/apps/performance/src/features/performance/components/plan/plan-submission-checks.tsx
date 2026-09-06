"use client";

import { useState } from "react";
import { Check, ChevronDown, X } from "lucide-react";
import type { PlanReadinessDto } from "@repo/api";
import { Button } from "@repo/ds/components/ui/button";
import { cn } from "@repo/ds/lib/utils";
import { planChecks } from "./plan-lib";

/**
 * Why the plan can or cannot be submitted, drawn from the same readiness facts as the Submit gate.
 * When every condition is met the card stays quiet and collapsed — a single "N checks passed" line
 * over a reveal — because a wall of green ticks is noise. When conditions fail the card leads with
 * them, actionably, and the passing ones recede. It never hard-codes the valid state.
 */
export function PlanSubmissionChecks({ readiness }: { readiness: PlanReadinessDto }) {
  const checks = planChecks(readiness);
  const failed = checks.filter((check) => !check.passed);
  const passedCount = checks.length - failed.length;
  const allPassed = failed.length === 0;

  const [open, setOpen] = useState(true);

  return (
    <section className="rounded-2xl border border-border bg-card p-5">
      <p className="type-eyebrow text-muted-foreground">Submission checks</p>

      {allPassed ? (
        <>
          <div className="mt-3 flex items-start justify-between gap-3">
            <div className="flex items-start gap-2.5">
              <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-success/15 text-success">
                <Check className="size-3.5" aria-hidden />
              </span>
              <div>
                <p className="text-sm font-medium text-foreground">
                  {passedCount} check{passedCount === 1 ? "" : "s"} passed
                </p>
                <p className="mt-0.5 text-xs text-muted-foreground">Your plan meets all requirements.</p>
              </div>
            </div>
            <Button
              variant="ghost"
              size="icon-sm"
              className="-mr-1 shrink-0"
              onClick={() => setOpen((v) => !v)}
              aria-expanded={open}
              aria-label={open ? "Hide checks" : "View checks"}
            >
              <ChevronDown className={cn("size-4 transition-transform", open && "rotate-180")} aria-hidden />
            </Button>
          </div>
          {open ? (
            <ul className="mt-4 space-y-4 border-t border-border pt-4">
              {checks.map((check) => (
                <CheckRow key={check.id} passed label={check.label} />
              ))}
            </ul>
          ) : null}
        </>
      ) : (
        <>
          <p className="mt-3 text-sm font-medium text-foreground">
            {failed.length} check{failed.length === 1 ? "" : "s"} need
            {failed.length === 1 ? "s" : ""} attention
          </p>
          <ul className="mt-4 space-y-4">
            {failed.map((check) => (
              <CheckRow key={check.id} passed={false} label={check.detail ?? check.label} />
            ))}
          </ul>
          {passedCount > 0 ? (
            <ul className="mt-4 space-y-4 border-t border-border pt-4">
              {checks
                .filter((check) => check.passed)
                .map((check) => (
                  <CheckRow key={check.id} passed label={check.label} muted />
                ))}
            </ul>
          ) : null}
        </>
      )}
    </section>
  );
}

function CheckRow({ passed, label, muted = false }: { passed: boolean; label: string; muted?: boolean }) {
  return (
    <li className="flex items-start gap-2.5 text-sm">
      {passed ? (
        <Check className={cn("mt-0.5 size-4 shrink-0", muted ? "text-success/60" : "text-success")} aria-hidden />
      ) : (
        <X className="mt-0.5 size-4 shrink-0 text-destructive" aria-hidden />
      )}
      <span className={cn(muted ? "text-muted-foreground" : passed ? "text-foreground" : "text-foreground")}>
        {label}
      </span>
    </li>
  );
}
