import { AlertTriangle, Ban, Check } from "lucide-react";
import { cn } from "@repo/ds/lib/utils";

/**
 * How far the tenant has travelled, inside the activation surface rather than
 * across the page.
 *
 * As a page-wide band it drew the eye first and answered least — three
 * milestones, only one of which is ever in question. Compact and secondary, it
 * gives the surrounding facts their context without competing with them.
 *
 * Each milestone states its own condition in words. A blocked activation and a
 * waiting one look different, but they must also read differently for anyone
 * who cannot tell the two tints apart.
 */

export type ActivationPhase =
  | "pending-sent"
  | "pending-delivery-failed"
  | "blocked"
  | "active";

type MilestoneState =
  | "complete"
  | "waiting"
  | "action-required"
  | "blocked"
  | "pending";

const STATE_LABEL: Record<MilestoneState, string> = {
  complete: "Complete",
  waiting: "Waiting",
  "action-required": "Action required",
  blocked: "Blocked",
  // Deliberately not "Not started": that phrase belongs to Core HR setup, and
  // reusing it here would imply this milestone is something someone begins.
  pending: "Pending",
};

/**
 * The middle milestone carries the whole story; the first is always done by the
 * time this page exists, and the last simply follows.
 */
const PHASES: Record<
  ActivationPhase,
  [MilestoneState, MilestoneState, MilestoneState]
> = {
  "pending-sent": ["complete", "waiting", "pending"],
  "pending-delivery-failed": ["complete", "action-required", "pending"],
  blocked: ["complete", "blocked", "pending"],
  active: ["complete", "complete", "complete"],
};

const MILESTONES = ["Provisioned", "Administrator activation", "Active"] as const;

export function ActivationProgression({ phase }: { phase: ActivationPhase }) {
  const states = PHASES[phase];

  return (
    <ol className="flex flex-col gap-2 sm:flex-row sm:items-stretch sm:gap-0">
      {MILESTONES.map((milestone, index) => {
        const state = states[index]!;
        const isFirst = index === 0;
        const isLast = index === MILESTONES.length - 1;

        return (
          <li
            key={milestone}
            // Stacked, the marker sits beside its label; in a row, above it and
            // centred on it. The label never shares a line with the marker on a
            // narrow screen, where "Administrator activation · Action required"
            // could only fit by being clipped — and a clipped state says
            // nothing.
            className="flex min-w-0 items-center gap-2.5 sm:flex-1 sm:flex-col sm:items-center sm:gap-1.5"
          >
            {/* Every milestone takes an equal share of the width, so the rail
                spans the whole surface and each marker sits centred in its own
                share with its label beneath it. */}
            <div className="flex shrink-0 items-center gap-2 sm:w-full">
              <Connector
                filled={state === "complete"}
                className={isFirst ? "sm:invisible" : undefined}
              />
              <Marker state={state} />
              <Connector
                filled={!isLast && states[index + 1] === "complete"}
                className={isLast ? "sm:invisible" : undefined}
              />
            </div>

            <div className="min-w-0 sm:px-2 sm:text-center">
              <p className="text-sm font-medium leading-tight text-foreground">
                {milestone}
              </p>
              <p
                className={cn(
                  "mt-0.5 text-xs",
                  state === "action-required" || state === "blocked"
                    ? "font-medium text-destructive"
                    : "text-muted-foreground"
                )}
              >
                {STATE_LABEL[state]}
              </p>
            </div>
          </li>
        );
      })}
    </ol>
  );
}

/**
 * The rail between markers. Decorative, and hidden rather than removed at the
 * two outer ends so every milestone keeps the same width and the markers stay
 * evenly spaced across the surface.
 */
function Connector({
  filled,
  className,
}: {
  filled: boolean;
  className?: string;
}) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "hidden h-px flex-1 sm:block",
        filled ? "bg-primary/40" : "bg-border",
        className
      )}
    />
  );
}

function Marker({ state }: { state: MilestoneState }) {
  const shared = "flex size-5 shrink-0 items-center justify-center rounded-full";

  if (state === "complete") {
    return (
      <span
        aria-hidden="true"
        className={cn(shared, "bg-primary text-primary-foreground")}
      >
        <Check className="size-3" strokeWidth={3} />
      </span>
    );
  }

  if (state === "action-required") {
    return (
      <span
        aria-hidden="true"
        className={cn(shared, "bg-destructive/15 text-destructive")}
      >
        <AlertTriangle className="size-3" />
      </span>
    );
  }

  if (state === "blocked") {
    return (
      <span
        aria-hidden="true"
        className={cn(shared, "bg-destructive/15 text-destructive")}
      >
        <Ban className="size-3" />
      </span>
    );
  }

  if (state === "waiting") {
    // Ringed rather than filled: the current milestone, not a finished one.
    return (
      <span
        aria-hidden="true"
        className={cn(shared, "border-2 border-foreground bg-background")}
      />
    );
  }

  return (
    <span
      aria-hidden="true"
      className={cn(shared, "border border-border bg-background")}
    />
  );
}
