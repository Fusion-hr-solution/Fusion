"use client";

import {
  ArrowLeft,
  ArrowRight,
  BarChart3,
  CalendarDays,
  FileText,
  Flag,
  LineChart,
  Minus,
  Percent,
  PieChart,
  Target,
  TrendingUp,
  Unlink,
  Users,
} from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import type { MeasurementDto, PlanObjectiveDto, ProgressUpdateDto } from "@repo/api";
import { Button } from "@repo/ds/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@repo/ds/components/ui/sheet";
import { AsyncButton, PageError, PageSkeleton } from "@repo/ds/shell";
import { cn } from "@repo/ds/lib/utils";
import { ScopeMark } from "../scope-mark";
import { formatDate } from "../../lib";
import { useObjectiveProgress, useProgressHistoryPager, useProgressMutations } from "../../api/use-performance";
import { DerivedCard, ProgressUpdateComposer } from "../progress/progress-update-composer";
import { ProgressHistoryTimeline } from "../progress/progress-history-timeline";
import {
  MEASUREMENT_METHOD_LABEL,
  PROGRESS_TONE_TEXT,
  formatMeasureValue,
  objectiveProgressTone,
  pct,
} from "./plan-lib";

type DrawerMode = "details" | "record";

/**
 * The single objective drawer, shared across every plan screen — the employee authoring, the reviewer
 * deciding, anyone reading a locked plan — so an objective looks and reads identically wherever it is
 * opened. A right-hand drawer, not a route: the ledger stays in place with the inspected row lit.
 *
 * One shell, two modes. **Details** carries everything the row abbreviates (description, the direction it
 * supports, how it is measured, its timeline, and its plan weight) plus — on a locked plan — the current
 * progress and its history. **Record progress** transitions the same drawer in place to a focused
 * recorder, and returns to the updated details on save. Record mode is owner-only: it appears only when
 * `cycleId` is set (the owner's locked plan) and the objective can still be updated. The reviewer opens
 * the same drawer without `cycleId` and gets details alone.
 */
export function ObjectiveDetailDrawer({
  objective,
  index,
  alignmentScope,
  open,
  onOpenChange,
  cycleId,
  initialMode,
}: {
  objective: PlanObjectiveDto | null;
  /** Zero-based position in the ledger — shown as the same two-digit chip the row carries. */
  index: number;
  /** Resolved scope label of the aligned parent (e.g. "Talent Pod"); falls back to the parent title. */
  alignmentScope?: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Set on a locked plan to add execution progress + the owner-only record mode; unset keeps read-only detail. */
  cycleId?: string | null;
  /** Which mode to open into — "record" only takes effect on the owner's locked, still-updatable objective. */
  initialMode?: DrawerMode;
}) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="flex w-full flex-col gap-0 overflow-y-auto p-0 data-[side=right]:sm:max-w-[540px]">
        {objective ? (
          <ObjectiveDetailBody
            objective={objective}
            index={index}
            alignmentScope={alignmentScope}
            cycleId={open ? cycleId ?? null : null}
            initialMode={initialMode ?? "details"}
          />
        ) : null}
      </SheetContent>
    </Sheet>
  );
}

function ObjectiveDetailBody({
  objective,
  index,
  alignmentScope,
  cycleId,
  initialMode,
}: {
  objective: PlanObjectiveDto;
  index: number;
  alignmentScope?: string;
  cycleId: string | null;
  initialMode: DrawerMode;
}) {
  const weight = objective.planWeight ?? 0;
  const measurement = objective.measurement;
  const parentTitle = objective.directionPath.at(-1);
  const supports = objective.directionPath.at(-2);

  // Record mode is the owner's affordance on a locked, still-updatable objective. Progress + mutations are
  // fetched once here and shared by the details progress sections and the recorder.
  const canRecord = Boolean(cycleId) && objective.canUpdateProgress;
  const progressQuery = useObjectiveProgress(cycleId, objective.id);
  const mutations = useProgressMutations(cycleId ?? "none", objective.id);
  const historyPager = useProgressHistoryPager(
    cycleId ?? "",
    objective.id,
    progressQuery.data?.history ?? [],
    progressQuery.data?.historyNextCursor ?? null
  );

  const [mode, setMode] = useState<DrawerMode>(canRecord ? initialMode : "details");
  // Re-seed when the drawer is pointed at a different objective (or reopened): honor the requested mode,
  // but never strand a non-owner in record mode.
  useEffect(() => {
    setMode(canRecord ? initialMode : "details");
  }, [objective.id, initialMode, canRecord]);

  if (mode === "record" && canRecord && cycleId) {
    return (
      <RecordProgressBody
        objective={objective}
        index={index}
        progressQuery={progressQuery}
        mutations={mutations}
        onBack={() => setMode("details")}
      />
    );
  }

  return (
    <>
      <DrawerHeader objective={objective} index={index} />
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

          {measurement?.method === "NumericTarget" ? <NumericTargetStrip measurement={measurement} /> : null}

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

        {cycleId ? (
          <ProgressSections
            objective={objective}
            history={historyPager.items}
            hasMore={historyPager.hasMore}
            loadingMore={historyPager.loadingMore}
            onLoadMore={historyPager.loadMore}
            canRecord={canRecord}
            onRecord={() => setMode("record")}
          />
        ) : null}
      </div>
    </>
  );
}

/** The shared drawer header — number chip, title, and the objective's kind, mirroring the ledger row. */
function DrawerHeader({ objective, index }: { objective: PlanObjectiveDto; index: number }) {
  return (
    <div className="border-b border-border px-5 pb-4 pt-5 pr-12">
      <div className="flex items-start gap-3.5">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-lg border border-primary/25 bg-primary/[0.06] text-base font-semibold tabular-nums text-primary">
          {String(index + 1).padStart(2, "0")}
        </span>
        <div className="min-w-0">
          <SheetTitle className="text-[0.95rem] leading-snug tracking-tight">{objective.title}</SheetTitle>
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
  );
}

/**
 * Record progress mode — the same drawer shell turned to the one job of reporting execution. It curates
 * only what anchors the update: the objective identity, a compact measurement reminder, the current
 * reported state, and the measurement-aware recorder. Baseline fields stay locked and out of reach; the
 * back affordance returns to the full details read, and a value-based save returns there automatically so
 * the just-recorded truth is confirmed in context.
 */
function RecordProgressBody({
  objective,
  index,
  progressQuery,
  mutations,
  onBack,
}: {
  objective: PlanObjectiveDto;
  index: number;
  progressQuery: ReturnType<typeof useObjectiveProgress>;
  mutations: ReturnType<typeof useProgressMutations>;
  onBack: () => void;
}) {
  const progress = progressQuery.data;
  const measurement = objective.measurement;
  const [canSubmit, setCanSubmit] = useState(false);
  const formId = "record-progress-form";

  return (
    <>
      <DrawerHeader objective={objective} index={index} />
      <SheetDescription className="sr-only">Record progress for the objective {objective.title}.</SheetDescription>

      {/* Only the content scrolls; the footer stays pinned to the drawer's base regardless of content height. */}
      <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-5 pb-5 pt-5">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
        >
          <ArrowLeft className="size-3.5" aria-hidden /> Back to objective details
        </button>

        {/* What this objective is measured against — the agreed baseline, read-only. */}
        <RecordMeasurementCard measurement={measurement} />

        {/* The recorder. A single live progress readout carries both the current state (at rest) and the
            pending update, so there is no separate current-progress panel to duplicate it. */}
        <div className="border-t border-border pt-5">
          <p className="text-sm font-semibold tracking-tight text-foreground">Record progress</p>
          <div className="mt-4">
            {progressQuery.isLoading ? (
              <PageSkeleton rows={2} label="Loading progress" />
            ) : progressQuery.error || !progress ? (
              <PageError title="Progress unavailable" description={progressQuery.error?.message} onRetry={progressQuery.refetch} />
            ) : (
              <ProgressUpdateComposer
                progress={progress}
                submitting={mutations.submit.isLoading}
                formId={formId}
                onSubmit={(request) => mutations.submit.mutateAsync(request).then(() => undefined)}
                upload={(file) => mutations.uploadEvidence.mutateAsync(file)}
                onValidityChange={setCanSubmit}
                onRecorded={onBack}
              />
            )}
          </div>
        </div>
      </div>

      {/* Pinned footer — the two terminal actions sit at the drawer's base, not at the end of the content. */}
      <div className="flex items-center justify-between gap-3 border-t border-border bg-background px-5 py-3.5">
        <Button type="button" variant="outline" onClick={onBack}>
          Cancel
        </Button>
        <AsyncButton type="submit" form={formId} pending={mutations.submit.isLoading} disabled={!canSubmit || !progress}>
          Record progress
        </AsyncButton>
      </div>
    </>
  );
}

/**
 * The measurement reminder in record mode — the same titled card the details drawer leads with, curated
 * to the facts that anchor an update: the method, its measure, and the numeric target or milestone
 * totals. Read-only; the baseline is settled.
 */
function RecordMeasurementCard({ measurement }: { measurement: MeasurementDto | null }) {
  return (
    <Card
      icon={<BarChart3 className="size-5" aria-hidden />}
      iconTint="bg-primary/10 text-primary ring-primary/20"
      title="Measurement"
      subtitle={measurementSubtitle(measurement)}
    >
      {measurement?.method === "WeightedMilestones" ? (
        <div className="grid grid-cols-3 gap-3">
          <MiniFact dense icon={null} label="Measurement type" value={MEASUREMENT_METHOD_LABEL[measurement.method]} />
          <MiniFact
            dense
            icon={null}
            label="Milestones"
            value={`${measurement.milestones.length} milestone${measurement.milestones.length === 1 ? "" : "s"}`}
          />
          <MiniFact
            dense
            icon={null}
            label="Total weight"
            value={`${pct(measurement.milestones.reduce((sum, m) => sum + m.weight, 0))}%`}
          />
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          <MiniFact
            icon={<FileText className="size-4" aria-hidden />}
            label="Measurement type"
            value={measurement ? MEASUREMENT_METHOD_LABEL[measurement.method] : "—"}
          />
          <MiniFact icon={<Percent className="size-4" aria-hidden />} label="Measure" value={measureLabel(measurement)} />
        </div>
      )}

      {measurement?.method === "NumericTarget" ? <NumericTargetStrip measurement={measurement} /> : null}
    </Card>
  );
}

/** The read-only numeric target line — baseline → target with the improvement direction, shared by both measurement cards. */
function NumericTargetStrip({ measurement }: { measurement: MeasurementDto }) {
  return (
    <div className="mt-3 rounded-xl border border-border bg-muted/40 px-3.5 py-3">
      <p className="type-eyebrow text-muted-foreground">Target</p>
      <p className="mt-1 inline-flex items-center gap-1.5 text-sm tabular-nums text-foreground">
        {formatMeasureValue(measurement.baseline, measurement.unit)}
        <ArrowRight className="size-3 text-muted-foreground" aria-hidden />
        {formatMeasureValue(measurement.target, measurement.unit)}
        {measurement.direction ? (
          <span className="text-muted-foreground">· {measurement.direction === "Decrease" ? "Decrease" : "Increase"}</span>
        ) : null}
      </p>
    </div>
  );
}

/**
 * The execution half of the drawer, present once the plan is locked: the objective's current progress
 * and its recorded history. Current progress reads from the plan objective itself (no waiting on a
 * fetch); the history is loaded per objective. Missing progress reads as missing — a dash and an
 * invitation to record the first update — never a fabricated 0%.
 */
function ProgressSections({
  objective,
  history,
  hasMore,
  loadingMore,
  onLoadMore,
  canRecord,
  onRecord,
}: {
  objective: PlanObjectiveDto;
  history: ProgressUpdateDto[];
  /** More older updates exist beyond the loaded page. */
  hasMore: boolean;
  loadingMore: boolean;
  onLoadMore: () => void;
  /** Owner on a still-updatable objective — reveals the Record progress action. */
  canRecord: boolean;
  onRecord: () => void;
}) {
  const has = objective.hasProgress;
  const tone = objectiveProgressTone(objective.isAligned, objective.derivedProgress);
  const updated = objective.lastProgressAt ? formatDate(objective.lastProgressAt.slice(0, 10)) : null;
  const milestones =
    objective.measurement?.method === "WeightedMilestones" ? objective.measurement.milestones : null;
  const subtitle = milestones
    ? `${milestones.filter((m) => m.isCompleted).length} of ${milestones.length} milestone${milestones.length === 1 ? "" : "s"} completed · ${pct(objective.derivedProgress)}% of total weight`
    : updated
      ? `Updated ${updated}`
      : undefined;

  return (
    <>
      {/* Current progress — the same derived-progress card the recorder uses, so the read and the update
          speak one visual language. Missing reads as missing, never a fabricated 0%. */}
      <section className="border-t border-border pt-5">
        <div className="flex items-center justify-between gap-2">
          <p className="type-eyebrow text-muted-foreground">Current progress</p>
          {canRecord ? (
            <Button size="sm" className="shrink-0" onClick={onRecord}>
              <LineChart className="size-3.5" data-icon="inline-start" /> Record progress
            </Button>
          ) : null}
        </div>
        <div className="mt-3">
          {has ? (
            <DerivedCard derived={objective.derivedProgress} subtitle={subtitle} />
          ) : (
            <div className="flex items-center gap-3.5 rounded-xl border border-border bg-muted/25 p-4">
              <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground/60">
                <Minus className="size-5" aria-hidden />
              </span>
              <div className="min-w-0">
                <p className="text-sm font-medium text-foreground">No progress reported yet</p>
                {canRecord ? (
                  <p className="mt-0.5 text-xs text-muted-foreground">Be the first to record progress on this objective.</p>
                ) : null}
              </div>
            </div>
          )}
        </div>
      </section>

      {/* Progress history — the recorded updates, newest first, closing on the first update. */}
      <section className="border-t border-border py-5">
        <p className="type-eyebrow text-muted-foreground">Progress history</p>
        {history.length === 0 ? (
          <div className="mt-3 flex items-center gap-4">
            <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground/70">
              <TrendingUp className="size-5" aria-hidden />
            </span>
            <div className="min-w-0">
              <p className="text-sm font-medium text-foreground">No progress history yet</p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {canRecord ? "Updates you record will appear here." : "No updates have been recorded yet."}
              </p>
            </div>
          </div>
        ) : (
          <ProgressHistoryTimeline
            history={history}
            toneClass={PROGRESS_TONE_TEXT[tone]}
            hasMore={hasMore}
            loadingMore={loadingMore}
            onLoadMore={onLoadMore}
          />
        )}
      </section>
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

/**
 * A fact inside a card: an icon disc beside a labelled value, values allowed to wrap within the tile.
 * `dense` drops the disc and stacks the label over the value — used when three facts share a row and the
 * disc would crowd the text.
 */
function MiniFact({ icon, label, value, dense }: { icon: ReactNode; label: string; value: string; dense?: boolean }) {
  if (dense) {
    return (
      <div className="rounded-xl border border-border bg-muted/40 p-3">
        <p className="type-eyebrow text-muted-foreground">{label}</p>
        <p className="mt-1.5 text-sm font-medium leading-snug text-foreground">{value}</p>
      </div>
    );
  }
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
