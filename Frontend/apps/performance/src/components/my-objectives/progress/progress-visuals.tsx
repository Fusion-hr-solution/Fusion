"use client";

import type { ReactNode } from "react";
import { CheckCircle2, Circle, CircleDot, TimerReset } from "lucide-react";
import type { ObjectiveProgressState, ObjectiveProgressStateDto } from "@repo/api";
import { cn } from "@/lib/utils";
import { progressTerms } from "./progress-terms";

/** Tone tokens shared by meters and badges — never color-only; always paired with text/shape. */
const STATE_TEXT: Record<ObjectiveProgressState, string> = {
  "not-started": progressTerms.notStarted,
  "in-progress": progressTerms.inProgress,
  completed: progressTerms.completed,
};

export function objectiveStateLabel(state: ObjectiveProgressState): string {
  return STATE_TEXT[state] ?? state;
}

/**
 * A weighted progress meter with a signature feel: a thick track with a filled bar whose colour
 * carries meaning, plus a caption. Completed reads calm-green, stale reads amber, in-progress reads
 * primary, not-started reads muted. Colour never stands alone — the caption states the value.
 */
export function ProgressMeter({
  percent,
  tone = "primary",
  className,
  height = "md",
}: {
  percent: number;
  tone?: "primary" | "success" | "warning" | "muted";
  className?: string;
  height?: "sm" | "md" | "lg";
}) {
  const clamped = Math.max(0, Math.min(100, percent));
  const track = height === "lg" ? "h-3" : height === "sm" ? "h-1.5" : "h-2";
  const fill =
    tone === "success"
      ? "bg-emerald-500 dark:bg-emerald-400"
      : tone === "warning"
        ? "bg-amber-500 dark:bg-amber-400"
        : tone === "muted"
          ? "bg-muted-foreground/40"
          : "bg-primary";

  return (
    <div
      className={cn("w-full overflow-hidden rounded-full bg-muted", track, className)}
      role="progressbar"
      aria-valuenow={clamped}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <div
        className={cn("h-full rounded-full transition-all duration-500", fill)}
        style={{ width: `${clamped}%` }}
      />
    </div>
  );
}

/**
 * State badge for one objective. Shape (icon) + word carry the state; colour reinforces it. A stale
 * objective adds a distinct "Needs update" marker so silence is legible without relying on colour.
 */
export function ObjectiveStateBadge({
  state,
  isStale,
  className,
}: {
  state: ObjectiveProgressState;
  isStale?: boolean;
  className?: string;
}) {
  const config: Record<ObjectiveProgressState, { icon: ReactNode; classes: string }> = {
    "not-started": {
      icon: <Circle className="size-3.5" />,
      classes: "text-muted-foreground bg-muted",
    },
    "in-progress": {
      icon: <CircleDot className="size-3.5" />,
      classes: "text-primary bg-primary/10",
    },
    completed: {
      icon: <CheckCircle2 className="size-3.5" />,
      classes: "text-emerald-700 bg-emerald-500/12 dark:text-emerald-300",
    },
  };
  const item = config[state] ?? config["not-started"];

  return (
    <span className="inline-flex items-center gap-1.5">
      <span
        className={cn(
          "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium",
          item.classes,
          className,
        )}
      >
        {item.icon}
        {objectiveStateLabel(state)}
      </span>
      {isStale ? (
        <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/12 px-2 py-1 text-xs font-medium text-amber-700 dark:text-amber-300">
          <TimerReset className="size-3.5" />
          {progressTerms.stale}
        </span>
      ) : null}
    </span>
  );
}

/** Picks the meter tone for a derived objective state. */
export function toneForObjective(state: ObjectiveProgressStateDto): "primary" | "success" | "warning" | "muted" {
  if (state.state === "completed") return "success";
  if (state.isStale) return "warning";
  if (state.state === "not-started") return "muted";
  return "primary";
}
