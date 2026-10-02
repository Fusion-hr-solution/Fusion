"use client";

import {
  formatMilestoneDue,
  isMilestoneOverdue,
  milestoneSchedule,
} from "../measurement/milestone-due";
import {
  SquareArrowEnter,
  CalendarRange,
  LineChart,
  MoreHorizontal,
  SquarePen,
  Target,
  Trash2,
  Unlink,
  Measurement,
  Milestones,
  NumericGoal,
  PercentMeasure,
} from "@/lib/icons";
import { TargetRange } from "./target-range";
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
  onViewAlignment,
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
  /** Opens the aligned parent objective's details. */
  onViewAlignment?: (parentId: string) => void;
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
      // The objective's type accent for everything inside that marks it: amber aligned, blue standalone.
      style={
        {
          "--type-accent": objective.isAligned
            ? "var(--primary)"
            : "var(--info)",
        } as React.CSSProperties
      }
      className={cn(
        "rounded-surface border p-5 transition-colors",
        !active
          ? "border-border bg-card"
          : objective.isAligned
            ? "border-primary/60 bg-card ring-1 ring-primary/25"
            : "border-info/60 bg-card ring-1 ring-info/25"
      )}
    >
      {/* Top line: identity + weight + actions. */}
      <div className="flex items-start gap-4">
        {/* The number takes the objective's type colour: amber when aligned, blue when standalone. */}
        <span
          className={cn(
            "flex size-10 shrink-0 items-center justify-center rounded-control border text-base font-semibold tabular-nums",
            objective.isAligned
              ? "border-primary-ring bg-primary-tint text-primary-ink"
              : "border-info/25 bg-info/[0.06] text-info"
          )}
        >
          {String(index + 1).padStart(2, "0")}
        </span>

        <div className="min-w-0 flex-1">
          {onViewDetails ? (
            <button
              type="button"
              onClick={onViewDetails}
              aria-pressed={active}
              className="rounded-control text-left font-medium tracking-tight text-foreground hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {objective.title}
            </button>
          ) : (
            <p className="font-medium tracking-tight text-foreground">
              {objective.title}
            </p>
          )}
          <p className="mt-1 flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-xs text-muted-foreground">
            {objective.isAligned ? (
              <>
                <Target className="size-4 shrink-0 text-primary-ink" aria-hidden />
                <span>
                  Aligned to{" "}
                  {onViewAlignment && objective.parentObjectiveId ? (
                    <button
                      type="button"
                      onClick={() =>
                        onViewAlignment(objective.parentObjectiveId!)
                      }
                      className="rounded-control font-medium text-primary-ink hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      {parentObjective ?? "direction"}
                    </button>
                  ) : (
                    <span className="font-medium text-primary-ink">
                      {parentObjective ?? "direction"}
                    </span>
                  )}
                </span>
                {alignmentScope ? (
                  <span className="text-muted-foreground/70">
                    · {alignmentScope}
                  </span>
                ) : null}
              </>
            ) : (
              <span className="inline-flex items-center gap-1.5 text-info">
                <Unlink className="size-4 shrink-0" aria-hidden />
                Standalone role objective
              </span>
            )}
          </p>
        </div>

        <div className="flex shrink-0 items-start gap-1">
          {canAuthor ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label={`Actions for ${objective.title}`}
                >
                  <MoreHorizontal className="size-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {onEdit ? (
                  <DropdownMenuItem onSelect={onEdit}>
                    <SquarePen className="size-3.5" /> Edit objective
                  </DropdownMenuItem>
                ) : null}
                {onRemove ? (
                  <DropdownMenuItem onSelect={onRemove} variant="destructive">
                    <Trash2 className="size-3.5" /> Remove objective
                  </DropdownMenuItem>
                ) : null}
              </DropdownMenuContent>
            </DropdownMenu>
          ) : onViewDetails ? (
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={onViewDetails}
              aria-label={`View ${objective.title}`}
              className="text-muted-foreground hover:text-foreground"
            >
              <SquareArrowEnter className="size-4 -scale-x-100" />
            </Button>
          ) : null}
        </div>
      </div>

      {/* Metadata line: measurement, its target, duration — separated cells, only ones that carry meaning.
          The inspect affordance closes the row on the reading/authoring states. */}
      <div className="mt-4 flex items-end gap-3 pl-14">
        <dl className="flex min-w-0 flex-1 flex-col gap-3 text-sm sm:flex-row sm:gap-0 sm:divide-x sm:divide-border">
          <MetaCell icon={Measurement} label="Measurement">
            {measurement ? MEASUREMENT_METHOD_LABEL[measurement.method] : "—"}
          </MetaCell>

          {measurement?.method === "NumericTarget" ? (
            <MetaCell icon={NumericGoal} label="Target">
              <span className="inline-flex items-center gap-1.5 tabular-nums">
                <TargetRange
                  baseline={measurement.baseline}
                  target={measurement.target}
                  unit={measurement.unit}
                  direction={measurement.direction}
                />
              </span>
            </MetaCell>
          ) : measurement?.method === "WeightedMilestones" ? (
            <MetaCell icon={Milestones} label="Milestones">
              <MilestoneStrip milestones={measurement.milestones} />
            </MetaCell>
          ) : (
            <MetaCell icon={PercentMeasure} label="Measure">
              Single percentage
            </MetaCell>
          )}

          <MetaCell icon={CalendarRange} label="Duration">
            {formatDateRange(objective.startDate, objective.endDate)}
          </MetaCell>
        </dl>
        <div className="shrink-0 text-right">
          <p className="type-eyebrow text-muted-foreground/70">Weight</p>
          <p
            className={cn(
              "mt-1 text-lg font-semibold tabular-nums leading-none",
              weight <= 0
                ? "text-muted-foreground/50"
                : objective.isAligned
                  ? "text-primary-ink"
                  : "text-info"
            )}
          >
            {pct(weight)}%
          </p>
        </div>
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
                  <LineChart className="size-3.5" data-icon="inline-start" />{" "}
                  Update progress
                </Button>
              ) : (
                <Button variant="ghost" size="sm" onClick={onOpenProgress}>
                  View
                </Button>
              )
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}

/**
 * The milestones' structure: one segment each, sized by its weight, beside a plain count. Structure only —
 * it reads the same in every plan state; completion belongs to the execution band, which segments its
 * progress bar the same way. Milestone weights always total 100%, so the total is never stated.
 */
function MilestoneStrip({ milestones }: { milestones: { weight: number; isCompleted: boolean }[] }) {
  // Completed milestones fill in the objective's colour; open ones stay as track.
  const done = milestones.filter((m) => m.isCompleted).length;
  return (
    <span className="inline-flex items-center gap-2.5">
      <span className="flex h-1.5 w-20 gap-0.5" aria-hidden>
        {milestones.map((m, i) => (
          <span
            key={i}
            className={cn(
              "h-full rounded-full",
              m.isCompleted ? "bg-[var(--type-accent,var(--primary))]" : "bg-muted-foreground/20"
            )}
            style={{ flexGrow: Math.max(m.weight, 1) }}
          />
        ))}
      </span>
      <span className="tabular-nums">
        {done > 0 ? `${done} of ${milestones.length} done` : `${milestones.length} milestone${milestones.length === 1 ? "" : "s"}`}
      </span>
    </span>
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
  const updated = objective.lastProgressAt
    ? formatDate(objective.lastProgressAt.slice(0, 10))
    : null;

  let label: string;
  let value: React.ReactNode;
  if (method === "WeightedMilestones") {
    const total = measurement?.milestones.length ?? 0;
    const done =
      measurement?.milestones.filter((m) => m.isCompleted).length ?? 0;
    const schedule = milestoneSchedule(measurement?.milestones ?? []);
    label = "Milestone progress";
    value = (
      <span className="tabular-nums">
        <span
          className={has ? PROGRESS_TONE_TEXT[tone] : "text-muted-foreground/60"}
        >
          {done} of {total} milestone{total === 1 ? "" : "s"}{" "}
          {has ? "completed" : "updated"}
        </span>
        {schedule.overdue > 0 ? (
          <span className="font-medium text-destructive">
            {" "}
            · {schedule.overdue} overdue
          </span>
        ) : schedule.nextDue ? (
          <span className="text-muted-foreground">
            {" "}
            · next due {formatMilestoneDue(schedule.nextDue)}
          </span>
        ) : null}
      </span>
    );
  } else if (method === "ManualPercentage") {
    label = "Current progress";
    value = has ? (
      <span className={cn("tabular-nums", PROGRESS_TONE_TEXT[tone])}>
        {pct(objective.currentPercentage ?? 0)}%
      </span>
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
      {method === "WeightedMilestones" && measurement ? (
        // Same segments as the Milestones fact above (sized by weight); completed ones fill.
        <div className="mt-2 flex h-2.5 w-full gap-1" aria-hidden>
          {measurement.milestones.map((m, i) => (
            <span
              key={i}
              className={cn(
                "h-full rounded-full",
                m.isCompleted
                  ? PROGRESS_TONE_BG[tone]
                  : isMilestoneOverdue(m)
                    ? "bg-destructive"
                    : "bg-muted-foreground/15"
              )}
              style={{ flexGrow: Math.max(m.weight, 1) }}
            />
          ))}
        </div>
      ) : (
        <div className="mt-2 h-2.5 w-full overflow-hidden rounded-full bg-muted-foreground/15">
          {has ? (
            <span
              className={cn(
                "block h-full rounded-full",
                PROGRESS_TONE_BG[tone]
              )}
              style={{ width: `${capped}%` }}
            />
          ) : null}
        </div>
      )}
      {has ? (
        <div className="mt-2 flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
          <span className="text-sm font-semibold">{value}</span>
          {updated ? <span className="text-xs text-muted-foreground">Updated {updated}</span> : null}
        </div>
      ) : null}
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
        <Icon className="size-4" aria-hidden />
        {label}
      </dt>
      <dd className="mt-1 whitespace-nowrap text-foreground">{children}</dd>
    </div>
  );
}
