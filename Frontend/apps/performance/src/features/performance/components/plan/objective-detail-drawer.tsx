"use client";

import {
  ArrowRight,
  BarChart3,
  CalendarDays,
  FileText,
  Flag,
  Percent,
  PieChart,
  Target,
  Unlink,
  Users,
} from "lucide-react";
import type { ReactNode } from "react";
import type { MeasurementDto, PlanObjectiveDto } from "@repo/api";
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@repo/ds/components/ui/sheet";
import { cn } from "@repo/ds/lib/utils";
import { ScopeMark } from "../scope-mark";
import { formatDate } from "../../lib";
import { MEASUREMENT_METHOD_LABEL, pct } from "./plan-lib";

/**
 * The full read of a single plan objective, opened from any ledger row's inspect affordance. It is the
 * one detail surface shared across every plan screen — the employee authoring, the reviewer deciding,
 * anyone reading a locked plan — so an objective looks and reads identically wherever it is inspected.
 * A right-hand drawer, not a route: the ledger stays in place with the inspected row lit, and the drawer
 * carries everything the row abbreviates (description, the direction it supports, how it is measured, its
 * timeline, and the weight it holds in the plan) as titled cards. Read-only — inspection, never editing.
 */
export function ObjectiveDetailDrawer({
  objective,
  index,
  alignmentScope,
  open,
  onOpenChange,
}: {
  objective: PlanObjectiveDto | null;
  /** Zero-based position in the ledger — shown as the same two-digit chip the row carries. */
  index: number;
  /** Resolved scope label of the aligned parent (e.g. "Talent Pod"); falls back to the parent title. */
  alignmentScope?: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full gap-0 p-0 data-[side=right]:sm:max-w-[540px]">
        {objective ? (
          <ObjectiveDetailBody objective={objective} index={index} alignmentScope={alignmentScope} />
        ) : null}
      </SheetContent>
    </Sheet>
  );
}

function ObjectiveDetailBody({
  objective,
  index,
  alignmentScope,
}: {
  objective: PlanObjectiveDto;
  index: number;
  alignmentScope?: string;
}) {
  const weight = objective.planWeight ?? 0;
  const measurement = objective.measurement;
  const parentTitle = objective.directionPath.at(-1);
  const supports = objective.directionPath.at(-2);

  return (
    <>
      {/* Header — number chip, title, and the objective's kind, mirroring the ledger row's identity. */}
      <div className="border-b border-border px-5 pb-4 pt-5 pr-12">
        <div className="flex items-start gap-3.5">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-lg border border-primary/25 bg-primary/[0.06] text-base font-semibold tabular-nums text-primary">
            {String(index + 1).padStart(2, "0")}
          </span>
          <div className="min-w-0">
            <SheetTitle className="text-[0.95rem] leading-snug tracking-tight">
              {objective.title}
            </SheetTitle>
            <p className="mt-1.5 inline-flex items-center gap-1.5 text-xs">
              {objective.isAligned ? (
                <span className="inline-flex items-center gap-1.5 font-medium text-primary">
                  <Target className="size-3 shrink-0" aria-hidden />
                  Aligned objective
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 font-medium text-info">
                  <Unlink className="size-3 shrink-0" aria-hidden />
                  Standalone role objective
                </span>
              )}
            </p>
          </div>
        </div>
      </div>
      <SheetDescription className="sr-only">
        Full details for the objective {objective.title}.
      </SheetDescription>

      <div className="min-h-0 flex-1 space-y-4 px-5 py-5">
        {objective.description ? (
          <Section label="Description">
            <p className="text-sm leading-relaxed text-foreground">{objective.description}</p>
          </Section>
        ) : null}

        <Section label="Alignment">
          {objective.isAligned && parentTitle ? (
            <div className="rounded-xl border border-border bg-muted/40 p-4">
              <div className="flex items-start gap-3">
                <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary ring-1 ring-primary/20">
                  <ScopeMark className="size-6" />
                </span>
                <div className="min-w-0">
                  <p className="text-sm font-medium tracking-tight text-foreground">{parentTitle}</p>
                  {supports ? <p className="mt-0.5 text-xs text-muted-foreground">{supports}</p> : null}
                </div>
              </div>
              {alignmentScope ? (
                <div className="mt-3 flex items-center gap-2 border-t border-border/70 pt-3 text-xs text-muted-foreground">
                  <Users className="size-3.5 shrink-0 text-muted-foreground/70" aria-hidden />
                  {alignmentScope}
                </div>
              ) : null}
            </div>
          ) : (
            <p className="flex items-center gap-2 text-sm text-muted-foreground">
              <Unlink className="size-3.5 shrink-0" aria-hidden />
              Not aligned to organizational direction — a standalone role objective.
            </p>
          )}
        </Section>

        {/* Measurement — a card leading with how progress is read, then the type and measure as facts. */}
        <Card
          icon={<BarChart3 className="size-5" aria-hidden />}
          iconTint="bg-primary/10 text-primary ring-primary/20"
          title="Measurement"
          subtitle={measurementSubtitle(measurement)}
        >
          <div className="grid grid-cols-2 gap-3">
            <MiniFact
              icon={<FileText className="size-4" aria-hidden />}
              label="Measurement type"
              value={measurement ? MEASUREMENT_METHOD_LABEL[measurement.method] : "—"}
            />
            <MiniFact
              icon={<Percent className="size-4" aria-hidden />}
              label="Measure"
              value={measureLabel(measurement)}
            />
          </div>

          {measurement?.method === "NumericTarget" ? (
            <div className="mt-3 rounded-xl border border-border bg-muted/40 px-3.5 py-3">
              <p className="type-eyebrow text-muted-foreground">Target</p>
              <p className="mt-1 inline-flex items-center gap-1.5 text-sm tabular-nums text-foreground">
                {numericValue(measurement.baseline, measurement.unit)}
                <ArrowRight className="size-3 text-muted-foreground" aria-hidden />
                {numericValue(measurement.target, measurement.unit)}
                {measurement.direction ? (
                  <span className="text-muted-foreground">· {measurement.direction === "Decrease" ? "Decrease" : "Increase"}</span>
                ) : null}
              </p>
            </div>
          ) : null}

          {measurement?.method === "WeightedMilestones" && measurement.milestones.length > 0 ? (
            <ul className="mt-3 space-y-2 rounded-xl border border-border bg-muted/40 px-3.5 py-3">
              {measurement.milestones.map((m) => (
                <li key={m.id} className="flex items-center gap-2.5 text-sm">
                  <Flag className="size-3.5 shrink-0 text-muted-foreground/70" aria-hidden />
                  <span className="min-w-0 flex-1 truncate text-foreground">{m.title}</span>
                  <span className="shrink-0 tabular-nums text-muted-foreground">{pct(m.weight)}%</span>
                </li>
              ))}
            </ul>
          ) : null}
        </Card>

        <div className="grid grid-cols-2 gap-4">
          {/* Timeline — the objective's window read as a start→end sequence. */}
          <Card
            icon={<CalendarDays className="size-5" aria-hidden />}
            iconTint="bg-muted text-muted-foreground ring-border"
            title="Timeline"
            subtitle="Cycle duration"
          >
            <ol className="flex h-full min-h-[7.5rem] flex-col">
              <TimelinePoint label="Start date" value={formatDate(objective.startDate)} connector />
              <TimelinePoint label="End date" value={formatDate(objective.endDate)} />
            </ol>
          </Card>

          {/* Plan weight — the share this objective holds, read as a single gauge. */}
          <Card
            icon={<PieChart className="size-5" aria-hidden />}
            iconTint="bg-muted text-muted-foreground ring-border"
            title="Plan weight"
            subtitle="Share of overall plan"
          >
            <div className="flex items-center justify-center pt-1">
              <WeightDonut value={weight} />
            </div>
          </Card>
        </div>
      </div>
    </>
  );
}

/** A titled detail card: an icon tile, a title, and a subtitle above caller content — the drawer's unit. */
function Card({
  icon,
  iconTint,
  title,
  subtitle,
  children,
}: {
  icon: ReactNode;
  iconTint: string;
  title: string;
  subtitle: string;
  children: ReactNode;
}) {
  return (
    <section className="flex flex-col rounded-2xl border border-border bg-card p-4">
      <div className="flex items-start gap-3">
        <span className={cn("flex size-11 shrink-0 items-center justify-center rounded-xl ring-1", iconTint)}>
          {icon}
        </span>
        <div className="min-w-0">
          <p className="font-semibold tracking-tight text-foreground">{title}</p>
          <p className="mt-0.5 text-sm leading-snug text-muted-foreground">{subtitle}</p>
        </div>
      </div>
      <div className="mt-4 flex-1">{children}</div>
    </section>
  );
}

/** A fact inside a card: an icon disc beside a labelled value, values allowed to wrap within the tile. */
function MiniFact({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border bg-muted/40 p-3.5">
      <div className="flex items-start gap-2.5">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground">
          {icon}
        </span>
        <div className="min-w-0">
          <p className="type-eyebrow text-muted-foreground">{label}</p>
          <p className="mt-1 text-sm font-medium leading-snug text-foreground">{value}</p>
        </div>
      </div>
    </div>
  );
}

/** One point on the timeline: an accent node (with an optional descending connector) beside its date. */
function TimelinePoint({ label, value, connector }: { label: string; value: string; connector?: boolean }) {
  return (
    <li className={cn("flex gap-3", connector && "min-h-0 flex-1")}>
      <div className="flex flex-col items-center pt-1">
        <span className="size-2.5 shrink-0 rounded-full bg-primary ring-2 ring-primary/20" />
        {connector ? <span className="mt-1 w-px flex-1 border-l border-dashed border-border" /> : null}
      </div>
      <div className={cn("min-w-0", connector && "pb-4")}>
        <p className="type-eyebrow text-muted-foreground">{label}</p>
        <p className="mt-0.5 text-sm text-foreground">{value}</p>
      </div>
    </li>
  );
}

/** The plan share as a single ring gauge with the percentage at its center — no legend, no second figure. */
function WeightDonut({ value }: { value: number }) {
  const size = 104;
  const stroke = 9;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const clamped = Math.max(0, Math.min(100, value));
  const dash = (clamped / 100) * c;

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          strokeWidth={stroke}
          className="stroke-muted-foreground/20"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={`${dash} ${c - dash}`}
          className={clamped > 0 ? "stroke-primary" : "stroke-transparent"}
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="text-xl font-semibold tabular-nums text-foreground">{pct(value)}%</span>
      </div>
    </div>
  );
}

/** A labelled section: an uppercase eyebrow over its content, the drawer's repeating rhythm. */
function Section({ label, children }: { label: string; children: ReactNode }) {
  return (
    <section>
      <p className="type-eyebrow text-muted-foreground">{label}</p>
      <div className="mt-2.5">{children}</div>
    </section>
  );
}

/** How this objective's progress is read, stated from its measurement method. */
function measurementSubtitle(measurement: MeasurementDto | null): string {
  switch (measurement?.method) {
    case "NumericTarget":
      return "Tracked against a numeric target.";
    case "WeightedMilestones":
      return "Tracked across weighted milestones.";
    case "ManualPercentage":
      return "Progress is updated manually during the cycle.";
    default:
      return "How progress is measured this cycle.";
  }
}

function measureLabel(measurement: MeasurementDto | null): string {
  if (!measurement) return "—";
  if (measurement.method === "NumericTarget") {
    if (measurement.unit === "%") return "Percentage";
    return measurement.unit ? `Value in ${measurement.unit}` : "Numeric value";
  }
  if (measurement.method === "WeightedMilestones") {
    return `${measurement.milestones.length} milestone${measurement.milestones.length === 1 ? "" : "s"}`;
  }
  return "Single percentage";
}

function numericValue(value: number | null, unit: string | null): string {
  if (value === null) return "—";
  return unit ? `${value}${unit}` : String(value);
}
