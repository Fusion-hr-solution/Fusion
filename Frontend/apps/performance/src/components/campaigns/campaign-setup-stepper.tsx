"use client";

import { Fragment } from "react";
import { Check, Rocket, type LucideIcon } from "lucide-react";
import { StatusBadge } from "@repo/ds/shell";
import { cn } from "@/lib/utils";
import { campaignRunway } from "./campaign-terminology";

export type RunwayStepKey =
  | "campaign"
  | "timeline"
  | "strategy"
  | "population"
  | "launch";

export type RunwayStep = {
  key: RunwayStepKey;
  label: string;
  icon: LucideIcon;
  done: boolean;
  hasError?: boolean;
  unsaved?: boolean;
};

/**
 * The launch runway: four setup gates leading to a launch pad. It is the page's
 * signature shape and its primary navigation at once — every station is a
 * free-navigate step. The pad stays dark until all gates clear, then ignites.
 */
export function CampaignRunwaySpine({
  steps,
  active,
  cleared,
  onSelect,
}: {
  steps: RunwayStep[];
  active: RunwayStepKey;
  cleared: boolean;
  onSelect: (key: RunwayStepKey) => void;
}) {
  const gates = steps.slice(0, -1);
  const launch = steps[steps.length - 1]!;
  const openGateCount = gates.filter((gate) => !gate.done).length;

  return (
    <section
      aria-label={campaignRunway.title}
      className="overflow-hidden rounded-2xl border border-border bg-card"
    >
      <header className="flex items-center justify-between gap-3 border-b border-border px-4 py-2.5 sm:px-5">
        <span className="flex items-center gap-2 text-sm font-medium text-foreground">
          <Rocket className="size-4 text-muted-foreground" />
          {campaignRunway.title}
        </span>
        <StatusBadge tone={cleared ? "success" : "warning"}>
          {cleared
            ? campaignRunway.cleared
            : campaignRunway.remaining(openGateCount)}
        </StatusBadge>
      </header>

      {/* Desktop: the runway runs left-to-right into the pad. */}
      <ol className="hidden items-start gap-0 px-5 py-5 md:flex">
        {gates.map((step, index) => (
          <Fragment key={step.key}>
            <li className="flex shrink-0 justify-center">
              <Station
                step={step}
                index={index}
                active={active === step.key}
                onSelect={onSelect}
              />
            </li>
            <li aria-hidden className="flex flex-1 justify-center pt-[1.625rem]">
              <Connector filled={step.done} />
            </li>
          </Fragment>
        ))}
        <li className="flex shrink-0 justify-center">
          <LaunchPadNode
            step={launch}
            active={active === launch.key}
            cleared={cleared}
            onSelect={onSelect}
          />
        </li>
      </ol>

      {/* Mobile: the runway stacks top-to-bottom, pad last. */}
      <ol className="flex flex-col gap-1 p-2 md:hidden">
        {gates.map((step, index) => (
          <li key={step.key}>
            <StationRow
              step={step}
              index={index}
              active={active === step.key}
              onSelect={onSelect}
            />
          </li>
        ))}
        <li>
          <LaunchPadRow
            step={launch}
            active={active === launch.key}
            cleared={cleared}
            onSelect={onSelect}
          />
        </li>
      </ol>
    </section>
  );
}

// ── Desktop pieces ───────────────────────────────────────────────────

function Station({
  step,
  index,
  active,
  onSelect,
}: {
  step: RunwayStep;
  index: number;
  active: boolean;
  onSelect: (key: RunwayStepKey) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onSelect(step.key)}
      aria-current={active ? "step" : undefined}
      className="group flex w-24 flex-col items-center gap-2 rounded-lg px-1 py-1 text-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring lg:w-28"
    >
      <StationNode step={step} index={index} active={active} />
      <StationLabel step={step} active={active} />
    </button>
  );
}

function StationNode({
  step,
  index,
  active,
}: {
  step: RunwayStep;
  index: number;
  active: boolean;
}) {
  const Icon = step.icon;
  return (
    <span className="relative">
      <span
        className={cn(
          "flex size-11 items-center justify-center rounded-xl border transition-[background-color,border-color,color,box-shadow] duration-200",
          step.hasError
            ? "border-destructive bg-destructive/10 text-destructive"
            : step.done
              ? "border-transparent bg-primary text-primary-foreground"
              : active
                ? "border-primary bg-primary/10 text-primary ring-2 ring-primary/25 group-hover:bg-primary/15"
                : "border-border bg-muted/40 text-muted-foreground group-hover:border-primary/40 group-hover:text-foreground"
        )}
      >
        {step.done && !step.hasError ? (
          <Check className="size-5" />
        ) : (
          <Icon className="size-5" />
        )}
        <span className="sr-only">
          {step.done ? campaignRunway.status.done : `Step ${index + 1}`}
        </span>
      </span>
      {step.unsaved ? (
        <span
          aria-hidden
          className="absolute -right-0.5 -top-0.5 size-2.5 rounded-full border-2 border-card bg-primary"
        />
      ) : null}
    </span>
  );
}

function StationLabel({ step, active }: { step: RunwayStep; active: boolean }) {
  return (
    <span className="flex flex-col items-center gap-0.5">
      <span
        className={cn(
          "text-sm font-medium leading-none transition-colors",
          active || step.done ? "text-foreground" : "text-muted-foreground"
        )}
      >
        {step.label}
      </span>
      {step.hasError ? (
        <span className="text-xs font-medium text-destructive">
          {campaignRunway.status.error}
        </span>
      ) : step.unsaved ? (
        <span className="text-xs font-medium text-primary">
          {campaignRunway.unsaved}
        </span>
      ) : null}
    </span>
  );
}

function Connector({ filled }: { filled: boolean }) {
  return (
    <span
      className={cn(
        "h-0.5 w-full max-w-24 rounded-full transition-colors duration-300",
        filled ? "bg-primary" : "bg-border"
      )}
    />
  );
}

function LaunchPadNode({
  step,
  active,
  cleared,
  onSelect,
}: {
  step: RunwayStep;
  active: boolean;
  cleared: boolean;
  onSelect: (key: RunwayStepKey) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onSelect(step.key)}
      aria-current={active ? "step" : undefined}
      className="group flex w-24 flex-col items-center gap-2 rounded-lg px-1 py-1 text-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring lg:w-28"
    >
      <span
        className={cn(
          "flex size-11 items-center justify-center rounded-xl border transition-[background-color,border-color,color,box-shadow] duration-300",
          cleared
            ? "border-transparent bg-primary text-primary-foreground shadow-lg shadow-primary/40 ring-4 ring-primary/15"
            : active
              ? "border-primary bg-primary/10 text-primary ring-2 ring-primary/25"
              : "border-dashed border-border bg-muted/40 text-muted-foreground group-hover:border-primary/40 group-hover:text-foreground"
        )}
      >
        <Rocket className={cn("size-5", cleared && "-rotate-45")} />
      </span>
      <span
        className={cn(
          "text-sm font-semibold leading-none transition-colors",
          cleared || active ? "text-foreground" : "text-muted-foreground"
        )}
      >
        {step.label}
      </span>
    </button>
  );
}

// ── Mobile pieces ────────────────────────────────────────────────────

function StationRow({
  step,
  index,
  active,
  onSelect,
}: {
  step: RunwayStep;
  index: number;
  active: boolean;
  onSelect: (key: RunwayStepKey) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onSelect(step.key)}
      aria-current={active ? "step" : undefined}
      className={cn(
        "flex w-full items-center gap-3 rounded-xl px-2 py-2 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        active ? "bg-muted/50" : "hover:bg-muted/30"
      )}
    >
      <StationNode step={step} index={index} active={active} />
      <span className="flex min-w-0 flex-1 flex-col">
        <span
          className={cn(
            "truncate text-sm font-medium",
            active || step.done ? "text-foreground" : "text-muted-foreground"
          )}
        >
          {step.label}
        </span>
        <span
          className={cn(
            "truncate text-xs",
            step.hasError
              ? "font-medium text-destructive"
              : step.unsaved
                ? "font-medium text-primary"
                : "text-muted-foreground"
          )}
        >
          {step.hasError
            ? campaignRunway.status.error
            : step.unsaved
              ? campaignRunway.unsaved
              : step.done
                ? campaignRunway.status.done
                : active
                  ? campaignRunway.status.active
                  : campaignRunway.status.todo}
        </span>
      </span>
    </button>
  );
}

function LaunchPadRow({
  step,
  active,
  cleared,
  onSelect,
}: {
  step: RunwayStep;
  active: boolean;
  cleared: boolean;
  onSelect: (key: RunwayStepKey) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onSelect(step.key)}
      aria-current={active ? "step" : undefined}
      className={cn(
        "flex w-full items-center gap-3 rounded-xl px-2 py-2 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        active ? "bg-muted/50" : "hover:bg-muted/30"
      )}
    >
      <span
        className={cn(
          "flex size-11 items-center justify-center rounded-xl border transition-[background-color,border-color,color]",
          cleared
            ? "border-transparent bg-primary text-primary-foreground"
            : active
              ? "border-primary bg-primary/10 text-primary ring-2 ring-primary/25"
              : "border-dashed border-border bg-muted/40 text-muted-foreground"
        )}
      >
        <Rocket className={cn("size-5", cleared && "-rotate-45")} />
      </span>
      <span className="flex min-w-0 flex-1 flex-col">
        <span
          className={cn(
            "truncate text-sm font-semibold",
            cleared || active ? "text-foreground" : "text-muted-foreground"
          )}
        >
          {step.label}
        </span>
        <span className="truncate text-xs text-muted-foreground">
          {cleared ? campaignRunway.cleared : campaignRunway.locked}
        </span>
      </span>
    </button>
  );
}
