"use client";

import {
  ArrowRight,
  CalendarRange,
  Eye,
  Flag,
  Gauge,
  LineChart,
  MoreHorizontal,
  Pencil,
  Target,
  Trash2,
  Unlink,
} from "lucide-react";
import type { PlanObjectiveDto } from "@repo/api";
import { Button } from "@repo/ds/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@repo/ds/components/ui/dropdown-menu";
import { cn } from "@repo/ds/lib/utils";
import { formatDate, formatDateRange } from "../../lib";
import {
  MEASUREMENT_METHOD_LABEL,
  PROGRESS_TONE_BG,
  PROGRESS_TONE_TEXT,
  formatMeasureValue,
  objectiveProgressTone,
  pct,
} from "./plan-lib";

/**
 * One objective inside a plan, read as a numbered ledger row rather than a nested card. The title and
 * its alignment lead; a quiet metadata line beneath (measurement, its target, duration) makes the
 * objective legible without reopening the editor; the plan weight is the emphasized figure. Authoring
 * actions live behind a single overflow menu so the reading rhythm stays clean, and the same row
 * serves the manager's read-only review (no menu) and a locked plan's progress (a track appears).
 */
export function PlanObjectiveRow({
  index,
  objective,
  alignmentScope,
  showProgress = false,
  active = false,
  onEdit,
  onRemove,
  onOpenProgress,
  onViewDetails,
}: {
  index: number;
  objective: PlanObjectiveDto;
  /** Resolved scope label of the aligned parent (e.g. "Talent Pod"); falls back to the parent title. */
  alignmentScope?: string;
  showProgress?: boolean;
  /** This row's detail drawer is open — the row lifts to the accent to anchor the inspected objective. */
  active?: boolean;
  onEdit?: () => void;
  onRemove?: () => void;
  onOpenProgress?: () => void;
  /** Opens the objective's detail surface. Shown on the reading/authoring rows (not the progress row). */
  onViewDetails?: () => void;
}) {
  const weight = objective.planWeight ?? 0;
  const progress = objective.derivedProgress;
  const capped = Math.min(progress, 100);
  const tone = objectiveProgressTone(objective.isAligned, progress);
  const canAuthor = Boolean(onEdit || onRemove);
  const measurement = objective.measurement;

  // An employee objective aligns to an objective, not to an OrgUnit: name the parent objective, keep
  // the owning unit as secondary context.
  const parentObjective = objective.directionPath.at(-1);

  return (
    <div
      className={cn(
        "rounded-xl border p-5 transition-colors",
        active
          ? "border-primary/60 bg-primary/[0.05] ring-1 ring-primary/25"
          : "border-border bg-muted/40"
      )}
    >
      {/* Top line: identity + weight + actions. */}
      <div className="flex items-start gap-4">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-lg border border-primary/25 bg-primary/[0.06] text-base font-semibold tabular-nums text-primary">
          {String(index + 1).padStart(2, "0")}
        </span>

        <div className="min-w-0 flex-1">
          <p className="font-medium tracking-tight text-foreground">{objective.title}</p>
          <p className="mt-1 flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-xs text-muted-foreground">
            {objective.isAligned ? (
              <>
                <Target className="size-3 shrink-0 text-primary/70" aria-hidden />
                <span>
                  Aligned to{" "}
                  <span className="font-medium text-primary">{parentObjective ?? "direction"}</span>
                </span>
                {alignmentScope ? (
                  <span className="text-muted-foreground/70">· {alignmentScope}</span>
                ) : null}
              </>
            ) : (
              <span className="inline-flex items-center gap-1.5 text-info">
                <Unlink className="size-3 shrink-0" aria-hidden />
                Standalone role objective
              </span>
            )}
          </p>
        </div>

        <div className="flex shrink-0 items-start gap-1">
          <div className="text-right">
            <p
              className={cn(
                "text-lg font-semibold tabular-nums leading-none",
                weight > 0 ? "text-primary" : "text-muted-foreground/50"
              )}
            >
              {pct(weight)}%
            </p>
            <p className="mt-1 type-eyebrow text-muted-foreground/70">Weight</p>
          </div>
          {canAuthor ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon-sm" aria-label={`Actions for ${objective.title}`}>
                  <MoreHorizontal className="size-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {onEdit ? (
                  <DropdownMenuItem onSelect={onEdit}>
                    <Pencil className="size-3.5" /> Edit objective
                  </DropdownMenuItem>
                ) : null}
                {onRemove ? (
                  <DropdownMenuItem onSelect={onRemove} variant="destructive">
                    <Trash2 className="size-3.5" /> Remove objective
                  </DropdownMenuItem>
                ) : null}
              </DropdownMenuContent>
            </DropdownMenu>
          ) : null}
        </div>
      </div>

      {/* Metadata line: measurement, its target, duration — separated cells, only ones that carry meaning.
          The inspect affordance closes the row on the reading/authoring states. */}
      <div className="mt-4 flex items-end gap-3 pl-14">
      <dl className="flex min-w-0 flex-1 flex-col gap-3 text-sm sm:flex-row sm:gap-0 sm:divide-x sm:divide-border">
        <MetaCell icon={Gauge} label="Measurement">
          {measurement ? MEASUREMENT_METHOD_LABEL[measurement.method] : "—"}
        </MetaCell>

        {measurement?.method === "NumericTarget" ? (
          <MetaCell icon={Target} label="Target">
            <span className="inline-flex items-center gap-1.5 tabular-nums">
              {formatMeasureValue(measurement.baseline, measurement.unit)}
              <ArrowRight className="size-3 text-muted-foreground" aria-hidden />
              {formatMeasureValue(measurement.target, measurement.unit)}
              {measurement.direction ? (
                <span className="text-muted-foreground">
                  · {measurement.direction === "Decrease" ? "Decrease" : "Increase"}
                </span>
              ) : null}
            </span>
          </MetaCell>
        ) : measurement?.method === "WeightedMilestones" ? (
          <MetaCell icon={Flag} label="Milestones">
            <span className="tabular-nums">
              {measurement.milestones.length} milestone{measurement.milestones.length === 1 ? "" : "s"}
              <span className="text-muted-foreground">
                {" "}
                · Total {measurement.milestones.reduce((sum, m) => sum + m.weight, 0)}%
              </span>
            </span>
          </MetaCell>
        ) : (
          <MetaCell icon={Target} label="Measure">
            Single percentage
          </MetaCell>
        )}

        <MetaCell icon={CalendarRange} label="Duration">
          {formatDateRange(objective.startDate, objective.endDate)}
        </MetaCell>
      </dl>
        {!showProgress ? (
          <Button
            variant="outline"
            size="icon-sm"
            className={cn(
              "shrink-0 self-end",
              active && "border-primary/40 bg-primary/10 text-primary hover:bg-primary/15 hover:text-primary"
            )}
            onClick={onViewDetails}
            aria-label={`View details for ${objective.title}`}
            aria-pressed={active}
          >
            <Eye className="size-4" />
          </Button>
        ) : null}
      </div>

      {/* Execution row for a locked plan: the approved measurement, its latest reported truth, and the
          two actions. Missing progress reads as missing (a dash and "not reported yet"), never as 0%. */}
      {showProgress ? (
        <div className="mt-4 flex items-center gap-4 border-t border-border/60 pt-4">
          <ExecutionState objective={objective} tone={tone} capped={capped} />

          <div className="flex shrink-0 items-center gap-1.5">
            {onOpenProgress ? (
              objective.canUpdateProgress ? (
                <Button variant="outline" size="sm" onClick={onOpenProgress}>
                  <LineChart className="size-3.5" data-icon="inline-start" /> Update progress
                </Button>
              ) : (
                <Button variant="ghost" size="sm" onClick={onOpenProgress}>
                  View
                </Button>
              )
            ) : null}
            {onViewDetails ? (
              <Button
                variant="outline"
                size="icon-sm"
                onClick={onViewDetails}
                aria-label={`View details for ${objective.title}`}
                aria-pressed={active}
                className={cn(
                  active && "border-primary/40 bg-primary/10 text-primary hover:bg-primary/15 hover:text-primary"
                )}
              >
                <Eye className="size-4" />
              </Button>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}

/**
 * The measurement-aware current-state block: a full-width progress meter over its own vocabulary —
 * numeric shows the raw current value (distinct from the derived progress the bar fills to); manual
 * shows the reported percentage; weighted milestones show completion truth. Missing progress never
 * coerces to 0% — the bar stays empty and it reads as not reported yet.
 */
function ExecutionState({
  objective,
  tone,
  capped,
}: {
  objective: PlanObjectiveDto;
  tone: ReturnType<typeof objectiveProgressTone>;
  capped: number;
}) {
  const measurement = objective.measurement;
  const method = measurement?.method;
  const has = objective.hasProgress;
  const updated = objective.lastProgressAt ? formatDate(objective.lastProgressAt.slice(0, 10)) : null;

  let label: string;
  let value: React.ReactNode;
  if (method === "WeightedMilestones") {
    const total = measurement?.milestones.length ?? 0;
    const done = measurement?.milestones.filter((m) => m.isCompleted).length ?? 0;
    label = "Milestone progress";
    value = (
      <span className={cn("tabular-nums", has ? PROGRESS_TONE_TEXT[tone] : "text-muted-foreground/60")}>
        {done} of {total} milestone{total === 1 ? "" : "s"} {has ? "completed" : "updated"}
      </span>
    );
  } else if (method === "ManualPercentage") {
    label = "Current progress";
    value = has ? (
      <span className={cn("tabular-nums", PROGRESS_TONE_TEXT[tone])}>{pct(objective.currentPercentage ?? 0)}%</span>
    ) : (
      <span className="text-muted-foreground/50">—</span>
    );
  } else {
    label = "Current value";
    value = has ? (
      <span className={cn("tabular-nums", PROGRESS_TONE_TEXT[tone])}>
        {formatMeasureValue(objective.currentActual, measurement?.unit ?? null)}
      </span>
    ) : (
      <span className="text-muted-foreground/50">—</span>
    );
  }

  return (
    <div className="min-w-0 flex-1">
      <p className="type-eyebrow text-muted-foreground/70">{label}</p>
      <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-muted">
        {has ? (
          <span
            className={cn("block h-full rounded-full", PROGRESS_TONE_BG[tone])}
            style={{ width: `${capped}%` }}
          />
        ) : null}
      </div>
      <div className="mt-2 flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
        <span className="text-sm font-semibold">{value}</span>
        <span className="text-xs text-muted-foreground">
          {has ? (updated ? `Updated ${updated}` : null) : "Progress not reported yet"}
        </span>
      </div>
    </div>
  );
}

function MetaCell({
  icon: Icon,
  label,
  children,
}: {
  icon: typeof Target;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="min-w-0 sm:px-5 sm:first:pl-0">
      <dt className="flex items-center gap-1.5 type-eyebrow text-muted-foreground/70">
        <Icon className="size-3" aria-hidden />
        {label}
      </dt>
      <dd className="mt-1 whitespace-nowrap text-foreground">{children}</dd>
    </div>
  );
}
