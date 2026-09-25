"use client";

import Link from "next/link";
import { Check } from "lucide-react";
import { cn } from "@repo/ds";

export type ImportStep = {
  key: string;
  label: string;
  /** Quiet second line under the label, e.g. "Automatically matched". */
  detail?: string;
  state: "done" | "current" | "upcoming";
  href?: string | null;
};

/**
 * The one Upload → Match → Review journey, shared by Upload and the attempt shell so moving
 * between them reads as the same journey advancing. State changes animate: a finished stage
 * turns into a check and its connector fills, which is the visual handoff into the next stage.
 */
export function ImportStepper({
  steps,
  size = "default",
  className,
}: {
  steps: ImportStep[];
  size?: "default" | "compact";
  className?: string;
}) {
  const compact = size === "compact";
  return (
    <ol
      aria-label="Import steps"
      className={cn("flex shrink-0 items-start", compact ? "w-72" : "w-full max-w-xs sm:w-80", className)}
    >
      {steps.map((step, index) => {
        const content = (
          <>
            <span
              className={cn(
                "relative grid place-items-center rounded-full border tabular-nums transition-colors duration-[var(--duration-normal)]",
                compact ? "size-6 type-meta" : "size-8 type-label",
                step.state === "current" && "border-primary bg-background font-semibold text-primary-foreground dark:text-primary",
                step.state === "done" && "border-primary bg-primary text-primary-foreground",
                step.state === "upcoming" && "border-border bg-background text-muted-foreground"
              )}
              aria-hidden
            >
              {step.state === "done" ? (
                <Check className={compact ? "size-3.5" : "size-4"} strokeWidth={2.5} />
              ) : (
                index + 1
              )}
            </span>
            <span className="flex flex-col items-center text-center">
              <span
                className={cn(
                  compact ? "type-meta" : "type-label",
                  step.state === "current"
                    ? "font-semibold text-foreground"
                    : step.state === "done"
                      ? "text-foreground"
                      : "text-muted-foreground"
                )}
              >
                {step.label}
              </span>
              {step.detail ? (
                <span className="type-meta text-muted-foreground">
                  <span className="sr-only"> · </span>
                  {step.detail}
                </span>
              ) : null}
            </span>
          </>
        );
        return (
          <li
            key={step.key}
            aria-current={step.state === "current" ? "step" : undefined}
            className="relative flex flex-1 flex-col items-center"
          >
            {index < steps.length - 1 ? (
              <span
                className={cn("absolute left-1/2 h-0.5 w-full bg-border", compact ? "top-[11px]" : "top-[15px]")}
                aria-hidden
              >
                <span
                  className={cn(
                    "block h-full bg-primary transition-[width] duration-[var(--duration-reveal)] ease-out",
                    step.state === "done" ? "w-full" : "w-0"
                  )}
                />
              </span>
            ) : null}
            {step.href ? (
              <Link
                href={step.href}
                className={cn(
                  "relative flex flex-col items-center rounded-md outline-none focus-visible:ring-2 focus-visible:ring-ring [&:hover_span]:text-foreground",
                  compact ? "gap-1" : "gap-2"
                )}
              >
                {content}
              </Link>
            ) : (
              <span className={cn("relative flex flex-col items-center", compact ? "gap-1" : "gap-2")}>
                {content}
              </span>
            )}
          </li>
        );
      })}
    </ol>
  );
}
