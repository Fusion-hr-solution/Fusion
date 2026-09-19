"use client";

import Link from "next/link";
import { Check } from "lucide-react";
import { cn } from "@repo/ds/lib/utils";
import { SETUP_STEPS, setupStepHref, type SetupStep } from "./setup-readiness";

interface StepView {
  complete: boolean;
  accessible: boolean;
}

/**
 * The setup spine: numbered nodes with a title and caption, a connector that fills amber as steps
 * complete, and a glow on the step you're on. Completed / reachable steps navigate; a step whose
 * prerequisites don't exist yet stays quiet. Completion comes from domain truth, never local flags.
 */
export function CycleSetupStepper({
  current,
  state,
}: {
  current: SetupStep;
  state: Record<SetupStep, StepView>;
}) {
  return (
    <ol className="flex items-start">
      {SETUP_STEPS.map((step, index) => {
        const view = state[step.key];
        const isCurrent = step.key === current;
        const isLast = index === SETUP_STEPS.length - 1;
        const navigable = view.accessible && !isCurrent;

        const node = (
          <span
            className={cn(
              "flex size-9 shrink-0 items-center justify-center rounded-full border text-sm font-semibold tabular-nums transition-all",
              view.complete
                ? "border-transparent bg-primary text-primary-foreground"
                : isCurrent
                  ? "border-transparent bg-primary text-primary-foreground ring-4 ring-primary/20"
                  : "border-border bg-card text-muted-foreground",
            )}
          >
            {view.complete ? <Check className="size-4" aria-hidden /> : index + 1}
          </span>
        );

        return (
          <li key={step.key} className={cn("flex flex-col", isLast ? "shrink-0" : "flex-1")}>
            <div className="flex items-center">
              {navigable ? (
                <Link
                  href={setupStepHref(step.key)}
                  aria-label={step.label}
                  className="rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                >
                  {node}
                </Link>
              ) : (
                node
              )}
              {!isLast ? (
                <span
                  className={cn(
                    "mx-3 h-0.5 flex-1 rounded-full transition-colors",
                    view.complete ? "bg-primary" : "bg-border",
                  )}
                  aria-hidden
                />
              ) : null}
            </div>
            <div className="mt-3" aria-current={isCurrent ? "step" : undefined}>
              <div
                className={cn(
                  // step 1: aligned under its circle (as-is). step 2: centered on its circle.
                  // last step: text ends at the right edge of the stepper.
                  index === 1
                    ? "ml-[18px] w-max -translate-x-1/2 text-center"
                    : isLast
                      ? "ml-9 w-max -translate-x-full text-right"
                      : "pr-6 text-left",
                )}
              >
                <div
                  className={cn(
                    "type-label",
                    isCurrent || view.complete ? "text-foreground" : "text-muted-foreground",
                  )}
                >
                  {step.label}
                </div>
                <div className="type-meta mt-0.5 text-muted-foreground">{step.caption}</div>
              </div>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
