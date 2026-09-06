"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Flag,
  Info,
  LineChart,
  Minus,
  Percent,
  Plus,
  Target,
  TrendingDown,
  TrendingUp,
  UserRound,
} from "lucide-react";
import { toast } from "sonner";
import type {
  AddPlanObjectiveRequest,
  AlignmentTargetDto,
  CycleSummaryDto,
  ImprovementDirection,
  MeasurementInput,
  PlanObjectiveDto,
} from "@repo/api";
import { Button } from "@repo/ds/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@repo/ds/components/ui/dialog";
import { Input } from "@repo/ds/components/ui/input";
import { Label } from "@repo/ds/components/ui/label";
import { Textarea } from "@repo/ds/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
} from "@repo/ds/components/ui/select";
import {
  Autocomplete,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
} from "@repo/ds/components/ui/combobox";
import {
  DateRangePicker,
  type DateRangeValue,
} from "@repo/ds/components/ui/date-range-picker";
import { AsyncButton } from "@repo/ds/shell";
import { cn } from "@repo/ds/lib/utils";
import { parseNumeric } from "../../lib";
import { pct } from "./plan-lib";
import {
  MilestoneEditor,
  milestoneWeightSum,
  milestonesFromMeasurement,
  type MilestoneRow,
} from "../measurement/milestone-editor";

const TITLE_MAX = 300;
const DESCRIPTION_MAX = 2000;

/** Common measurement units offered as suggestions — any custom unit can still be typed. */
const UNIT_OPTIONS = [
  "Percent (%)",
  "Count",
  "Days",
  "Hours",
  "Score",
  "NPS",
  "Ratio",
  "Currency",
];

type AlignMode = "aligned" | "standalone";
type MeasurementMethod =
  | "ManualPercentage"
  | "NumericTarget"
  | "WeightedMilestones";

/**
 * The Employee Objective Composer — a large contextual modal opened by "Add objective" from My Plan,
 * leaving the plan visible behind it. One composer, five settled sections in order (Alignment →
 * Definition → Measurement → Plan weight → Dates), the same shell reused for edit. Measurement is a
 * placeholder shell in this pass (the dedicated measurement design slots into section 3 later); a new
 * objective is created as a manual-percentage measure, while editing preserves the objective's existing
 * measurement untouched.
 */
export function PlanGoalComposer({
  open,
  onOpenChange,
  cycle,
  targets,
  standaloneAllowed,
  objective,
  otherWeightTotal,
  onCreate,
  onUpdate,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  cycle: CycleSummaryDto;
  targets: AlignmentTargetDto[];
  standaloneAllowed: boolean;
  objective?: PlanObjectiveDto;
  /** Combined weight of the plan's other objectives — the allocation before this objective is committed. */
  otherWeightTotal: number;
  onCreate: (request: AddPlanObjectiveRequest) => Promise<void>;
  onUpdate: (request: AddPlanObjectiveRequest) => Promise<void>;
}) {
  const isEdit = Boolean(objective);

  const [mode, setMode] = useState<AlignMode>("aligned");
  const [parentId, setParentId] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [weight, setWeight] = useState("");
  const [method, setMethod] = useState<MeasurementMethod | null>(null);
  const [milestones, setMilestones] = useState<MilestoneRow[]>(() =>
    milestonesFromMeasurement(objective?.measurement)
  );
  const [baseline, setBaseline] = useState("");
  const [target, setTarget] = useState("");
  const [unit, setUnit] = useState("");
  const [direction, setDirection] = useState<ImprovementDirection>("Increase");
  // An explicit window override. Null means "not set" — the objective follows its inherited window
  // (the aligned parent's, or the cycle's) until the author picks a range.
  const [dateOverride, setDateOverride] = useState<DateRangeValue | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) return;
    const m = objective?.measurement;
    setMode(objective && !objective.isAligned ? "standalone" : "aligned");
    setParentId(objective?.parentObjectiveId ?? "");
    setTitle(objective?.title ?? "");
    setDescription(objective?.description ?? "");
    setWeight(
      objective?.planWeight != null ? String(objective.planWeight) : ""
    );
    const numeric = m?.method === "NumericTarget" ? m : null;
    setMethod(m?.method ?? null);
    setMilestones(milestonesFromMeasurement(m));
    setBaseline(numeric ? String(numeric.baseline) : "");
    setTarget(numeric ? String(numeric.target) : "");
    setUnit(numeric?.unit ?? "");
    setDirection(numeric?.direction ?? "Increase");
    // Editing starts from the objective's own dates; a new objective starts from the inherited window.
    setDateOverride(
      objective?.startDate
        ? { from: objective.startDate, to: objective.endDate ?? undefined }
        : null
    );
  }, [open, objective]);

  const selectedTarget = useMemo(
    () => targets.find((t) => t.id === parentId) ?? null,
    [targets, parentId]
  );

  // Order the alignment options broad → specific: company strategy first, then organizational
  // objectives grouped by their owning unit, alphabetical within each — so the closest direction
  // is easy to scan rather than an undifferentiated list.
  const targetGroups = useMemo(() => {
    const company = targets
      .filter((t) => t.ownershipScope === "Company")
      .sort((a, b) => a.title.localeCompare(b.title));
    const organizational = targets
      .filter((t) => t.ownershipScope !== "Company")
      .sort(
        (a, b) =>
          (a.orgUnitName ?? "").localeCompare(b.orgUnitName ?? "") ||
          a.title.localeCompare(b.title)
      );
    return { company, organizational };
  }, [targets]);

  const weightNum = Math.round(Number(weight) || 0);
  const alignValid = mode === "standalone" || parentId !== "";
  // A weighted-milestone measure is only complete once every named row carries a weight and the
  // weights total 100% — the same contract the domain enforces for milestone objectives.
  const milestoneSum = milestoneWeightSum(milestones);
  const milestonesComplete =
    milestones.every(
      (row) =>
        row.title.trim() !== "" &&
        Number(row.weight) > 0 &&
        Number(row.weight) <= 100
    ) && milestoneSum === 100;

  // A numeric measure needs a well-formed baseline and target that differ, plus a unit.
  const base = parseNumeric(baseline);
  const tgt = parseNumeric(target);
  const numericInvalid = base.invalid || tgt.invalid;
  const numericSameValue =
    base.num !== null && tgt.num !== null && base.num === tgt.num;
  const numericComplete =
    base.num !== null &&
    tgt.num !== null &&
    !numericInvalid &&
    !numericSameValue &&
    unit.trim() !== "";

  const measurementValid =
    method === "ManualPercentage"
      ? true
      : method === "WeightedMilestones"
        ? milestonesComplete
        : method === "NumericTarget"
          ? numericComplete
          : false;
  const valid =
    title.trim() !== "" &&
    alignValid &&
    weightNum > 0 &&
    weightNum <= 100 &&
    measurementValid;

  const disabledReason = !valid
    ? title.trim() === ""
      ? "Add a title first"
      : !alignValid
        ? "Choose the objective this aligns to"
        : !measurementValid
          ? method === null
            ? "Choose how progress is measured"
            : method === "WeightedMilestones"
              ? "Give each milestone a weight totalling 100%"
              : "Set a baseline, target, and unit for the measure"
          : weightNum <= 0
            ? "Give this objective a plan weight"
            : "Plan weight can be at most 100%"
    : undefined;

  // Allocation context — the plan before this objective (edit mode already excludes its own weight).
  const existing = clamp(otherWeightTotal, 0, 100);
  const remaining = Math.max(0, 100 - existing);
  const total = existing + weightNum;
  const totalTone =
    total === 100
      ? "text-success"
      : total > 100
        ? "text-destructive"
        : "text-muted-foreground";

  // The inherited window — the aligned parent's when aligned, otherwise the cycle's. It's the default
  // the objective takes until the author picks their own range, and the bounds every range stays within.
  const inheritedStart =
    (mode === "aligned" && selectedTarget?.startDate) || cycle.startDate;
  const inheritedEnd =
    (mode === "aligned" && selectedTarget?.endDate) || cycle.endDate;
  // The window shown and committed: the author's override when set, else the inherited window.
  const dateStart = dateOverride?.from ?? inheritedStart;
  const dateEnd = dateOverride?.to ?? inheritedEnd;

  // The measurement sent with the objective, authored from the section's controls.
  function buildMeasurement(): MeasurementInput {
    if (method === "WeightedMilestones")
      return {
        method: "WeightedMilestones",
        milestones: milestones
          .filter((row) => row.title.trim() !== "")
          .map((row) => ({
            title: row.title.trim(),
            weight: Number(row.weight),
          })),
      };
    if (method === "NumericTarget")
      return {
        method: "NumericTarget",
        baseline: base.num ?? 0,
        target: tgt.num ?? 0,
        unit: unit.trim(),
        direction,
      };
    return { method: "ManualPercentage" };
  }

  async function handleSubmit() {
    setSubmitting(true);
    try {
      const measurement = buildMeasurement();
      const request: AddPlanObjectiveRequest = {
        title: title.trim(),
        description: description.trim() || null,
        parentObjectiveId: mode === "aligned" ? parentId : null,
        startDate: dateStart,
        endDate: dateEnd,
        measurement,
        planWeight: weightNum,
      };
      if (isEdit) await onUpdate(request);
      else await onCreate(request);
      onOpenChange(false);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Could not save the objective."
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[92vh] w-full flex-col gap-0 overflow-hidden p-0 sm:max-w-4xl">
        {/* Header — identity + a compact snapshot of the plan's current allocation. */}
        <div className="flex flex-wrap items-start justify-between gap-4 border-b border-border px-6 py-5 pr-14">
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-3">
              <DialogTitle>
                {isEdit ? "Edit objective" : "Add objective"}
              </DialogTitle>
              {/* The objective's window — a real range picker beside the title. It defaults to the
                  inherited window (aligned parent's, or the cycle's) and stays bounded to the cycle. */}
              <DateRangePicker
                id="pg-dates"
                value={
                  dateOverride ?? { from: inheritedStart, to: inheritedEnd }
                }
                onChange={setDateOverride}
                min={cycle.startDate}
                max={cycle.endDate}
                className="h-8 px-2.5 text-sm shadow-2xs"
              />
            </div>
          </div>
          <div className="flex items-center gap-3 rounded-xl border border-border bg-muted/30 px-3.5 py-2">
            <div className="flex items-baseline gap-1.5">
              <span className="text-lg font-semibold tabular-nums leading-none text-primary">
                {pct(existing)}%
              </span>
              <span className="type-eyebrow text-muted-foreground">
                allocated
              </span>
            </div>
            <div
              className="h-1.5 w-16 overflow-hidden rounded-full bg-muted"
              role="img"
              aria-label={`${pct(existing)} percent of plan weight allocated`}
            >
              <span
                className="block h-full rounded-full bg-primary"
                style={{ width: `${existing}%` }}
              />
            </div>
            <span className="whitespace-nowrap text-xs tabular-nums text-muted-foreground">
              {pct(remaining)}% left
            </span>
          </div>
        </div>

        {/* Body — scrolls; header and footer stay put. */}
        <div className="flex-1 overflow-y-auto px-6 py-6">
          <div className="space-y-8">
            {/* 1. Alignment */}
            <Section
              n={1}
              title="Alignment"
              hint="Choose how this objective connects to organizational direction."
            >
              <div className="grid gap-3 sm:grid-cols-2">
                <ChoiceTile
                  active={mode === "aligned"}
                  icon={Target}
                  title="Aligned to direction"
                  detail="Align this objective to an existing organizational objective."
                  onClick={() => setMode("aligned")}
                />
                <ChoiceTile
                  active={mode === "standalone"}
                  icon={UserRound}
                  title="Standalone role objective"
                  detail={
                    standaloneAllowed
                      ? "Create an objective focused on your role and responsibilities."
                      : "Not permitted this cycle — every objective must align to direction."
                  }
                  disabled={!standaloneAllowed}
                  onClick={() => standaloneAllowed && setMode("standalone")}
                />
              </div>

              {mode === "aligned" ? (
                targets.length === 0 ? (
                  <p className="rounded-lg border border-dashed border-border px-3 py-4 text-sm text-muted-foreground">
                    No published organizational objectives to align to yet.
                  </p>
                ) : (
                  <Select value={parentId} onValueChange={setParentId}>
                    <SelectTrigger
                      aria-label="Select organizational objective"
                      className="h-auto w-full items-center whitespace-normal py-2.5 text-left data-[size=default]:h-auto [&>svg]:self-center"
                    >
                      {selectedTarget ? (
                        <TargetSummary target={selectedTarget} />
                      ) : (
                        <span className="text-muted-foreground">
                          Choose an organizational objective
                        </span>
                      )}
                    </SelectTrigger>
                    <SelectContent
                      position="popper"
                      align="start"
                      className="max-h-72 w-[var(--radix-select-trigger-width)] max-w-[calc(100vw-3rem)]"
                    >
                      {targetGroups.company.length > 0 ? (
                        <SelectGroup>
                          <SelectLabel>Company strategy</SelectLabel>
                          {targetGroups.company.map((t) => (
                            <TargetOption key={t.id} target={t} />
                          ))}
                        </SelectGroup>
                      ) : null}
                      {targetGroups.organizational.length > 0 ? (
                        <SelectGroup>
                          <SelectLabel>Organizational</SelectLabel>
                          {targetGroups.organizational.map((t) => (
                            <TargetOption key={t.id} target={t} />
                          ))}
                        </SelectGroup>
                      ) : null}
                    </SelectContent>
                  </Select>
                )
              ) : null}
            </Section>

            {/* 2. Objective definition */}
            <Section n={2} title="Objective definition">
              <div className="space-y-1.5">
                <div className="flex items-baseline justify-between">
                  <Label htmlFor="pg-title">
                    Title <span className="text-destructive">*</span>
                  </Label>
                  <span className="text-xs tabular-nums text-muted-foreground">
                    {title.length}/{TITLE_MAX}
                  </span>
                </div>
                <Input
                  id="pg-title"
                  value={title}
                  maxLength={TITLE_MAX}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Enter a clear and specific objective title"
                  autoFocus
                />
              </div>

              <div className="space-y-1.5">
                <div className="flex items-baseline justify-between">
                  <Label htmlFor="pg-desc">
                    Description{" "}
                    <span className="font-normal text-muted-foreground">
                      (optional)
                    </span>
                  </Label>
                  <span className="text-xs tabular-nums text-muted-foreground">
                    {description.length}/{DESCRIPTION_MAX}
                  </span>
                </div>
                <Textarea
                  id="pg-desc"
                  value={description}
                  maxLength={DESCRIPTION_MAX}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={3}
                  placeholder="Describe what success looks like, key outcomes, and why this objective is important."
                />
              </div>
            </Section>

            {/* 3. Measurement — the method choice. Manual percentage is built; the numeric and
                milestone editors slot in here in their own pass and stay unavailable until then. */}
            <Section
              n={3}
              title="Measurement"
              hint="How will you measure progress on this objective?"
            >
              <div className="grid gap-3 sm:grid-cols-3">
                <ChoiceTile
                  active={method === "ManualPercentage"}
                  icon={Percent}
                  title="Manual percentage"
                  detail="Update progress as a percentage throughout the cycle."
                  onClick={() => setMethod("ManualPercentage")}
                />
                <ChoiceTile
                  active={method === "NumericTarget"}
                  icon={LineChart}
                  title="Numeric target"
                  detail="Define a target with a numeric start and end value."
                  onClick={() => setMethod("NumericTarget")}
                />
                <ChoiceTile
                  active={method === "WeightedMilestones"}
                  icon={Flag}
                  title="Weighted milestones"
                  detail="Break the objective into milestones with assigned weights."
                  onClick={() => setMethod("WeightedMilestones")}
                />
              </div>

              {method === "ManualPercentage" ? (
                <div className="flex items-center gap-2.5 rounded-lg border border-info/25 bg-info-subtle px-3.5 py-2.5 text-sm text-info">
                  <Info className="size-4 shrink-0" aria-hidden />
                  You will manually update progress from 0% to 100% during the
                  cycle.
                </div>
              ) : null}

              {method === "NumericTarget" ? (
                <NumericTargetEditor
                  baseline={baseline}
                  target={target}
                  unit={unit}
                  direction={direction}
                  numericInvalid={numericInvalid}
                  sameValue={numericSameValue}
                  onBaseline={setBaseline}
                  onTarget={setTarget}
                  onUnit={setUnit}
                  onDirection={setDirection}
                />
              ) : null}

              {method === "WeightedMilestones" ? (
                <MilestoneEditor
                  milestones={milestones}
                  weightSum={milestoneSum}
                  onChange={setMilestones}
                />
              ) : null}
            </Section>

            {/* 4. Plan weight */}
            <Section
              n={4}
              title="Plan weight"
              hint="Assign the weight of this objective in your overall plan."
            >
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
                <div className="flex shrink-0 items-center gap-2">
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() =>
                      setWeight(String(clamp(weightNum - 5, 0, 100)))
                    }
                    disabled={weightNum <= 0}
                    aria-label="Decrease weight by 5"
                  >
                    <Minus className="size-4" />
                  </Button>
                  <div className="relative w-24">
                    <Input
                      id="pg-weight"
                      type="number"
                      inputMode="numeric"
                      value={weight}
                      min={0}
                      max={100}
                      onChange={(e) => setWeight(e.target.value)}
                      className="pr-7 text-right tabular-nums"
                      placeholder="0"
                      aria-label="Plan weight percent"
                    />
                    <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                      %
                    </span>
                  </div>
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() =>
                      setWeight(String(clamp(weightNum + 5, 0, 100)))
                    }
                    disabled={weightNum >= 100}
                    aria-label="Increase weight by 5"
                  >
                    <Plus className="size-4" />
                  </Button>
                </div>

                <div className="min-w-0 flex-1 space-y-1.5">
                  <div className="flex h-2 w-full overflow-hidden rounded-full bg-muted">
                    <span
                      className={cn(
                        "block h-full",
                        total === 100 ? "bg-success/60" : "bg-primary/60"
                      )}
                      style={{ width: `${existing}%` }}
                    />
                    <span
                      className={cn(
                        "block h-full",
                        total > 100
                          ? "bg-destructive"
                          : total === 100
                            ? "bg-success"
                            : "bg-primary"
                      )}
                      style={{ width: `${clamp(weightNum, 0, remaining)}%` }}
                    />
                  </div>
                  <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 text-xs">
                    <span className="text-muted-foreground">
                      <span className="font-medium tabular-nums text-foreground">
                        {pct(existing)}%
                      </span>{" "}
                      in your other objectives
                    </span>
                    <span className={cn("font-medium", totalTone)}>
                      Plan total{" "}
                      <span className="tabular-nums">{pct(total)}%</span>
                    </span>
                  </div>
                </div>
              </div>
              {/* <p className="text-xs text-muted-foreground">
                The total weight of all objectives in your plan must equal 100%.
              </p> */}
            </Section>
          </div>
        </div>

        {/* Footer — stable. Cancel is quiet; the primary action commits the pending objective. */}
        <div className="flex items-center justify-end gap-2 border-t border-border bg-muted/30 px-6 py-4">
          <Button
            variant="ghost"
            onClick={() => onOpenChange(false)}
            disabled={submitting}
          >
            Cancel
          </Button>
          <AsyncButton
            pending={submitting}
            disabled={!valid}
            onClick={handleSubmit}
            title={disabledReason}
          >
            {isEdit ? (
              "Save changes"
            ) : (
              <>
                Add objective <Plus className="size-4" data-icon="inline-end" />
              </>
            )}
          </AsyncButton>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ── Numbered section ──────────────────────────────────────────────────────────────

function Section({
  n,
  title,
  hint,
  children,
}: {
  n: number;
  title: string;
  hint?: string;
  children?: React.ReactNode;
}) {
  return (
    <section className="space-y-3">
      <div className="space-y-1">
        <h3 className="text-base font-semibold tracking-tight text-foreground">
          {n}. {title}
        </h3>
        {hint ? <p className="text-sm text-muted-foreground">{hint}</p> : null}
      </div>
      {children}
    </section>
  );
}

// ── Alignment choice tile ───────────────────────────────────────────────────────────

function ChoiceTile({
  active,
  icon: Icon,
  title,
  detail,
  disabled = false,
  onClick,
}: {
  active: boolean;
  icon: typeof Target;
  title: string;
  detail: string;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-pressed={active}
      className={cn(
        "flex items-start gap-3 rounded-xl border p-4 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
        active
          ? "border-primary bg-primary/[0.05] ring-1 ring-primary/30"
          : "border-border hover:border-primary/40 hover:bg-muted/40",
        disabled &&
          "cursor-not-allowed opacity-55 hover:border-border hover:bg-transparent"
      )}
    >
      <span
        className={cn(
          "mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full border",
          active ? "border-primary" : "border-muted-foreground/40"
        )}
        aria-hidden
      >
        {active ? <span className="size-2 rounded-full bg-primary" /> : null}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-semibold text-foreground">
          {title}
        </span>
        <span className="mt-0.5 block text-xs leading-snug text-muted-foreground">
          {detail}
        </span>
      </span>
      <Icon
        className={cn(
          "size-5 shrink-0",
          active ? "text-primary" : "text-muted-foreground/50"
        )}
        aria-hidden
      />
    </button>
  );
}

// ── Numeric target editor (baseline → target, unit, direction) ────────────────────────

function NumericTargetEditor({
  baseline,
  target,
  unit,
  direction,
  numericInvalid,
  sameValue,
  onBaseline,
  onTarget,
  onUnit,
  onDirection,
}: {
  baseline: string;
  target: string;
  unit: string;
  direction: ImprovementDirection;
  numericInvalid: boolean;
  sameValue: boolean;
  onBaseline: (v: string) => void;
  onTarget: (v: string) => void;
  onUnit: (v: string) => void;
  onDirection: (v: ImprovementDirection) => void;
}) {
  const error = numericInvalid
    ? "Enter a number — put a label like M€ or % in the Unit field."
    : sameValue
      ? "Baseline and target must differ."
      : null;
  return (
    <div className="space-y-3 rounded-xl border border-border/70 bg-muted/30 p-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <NumericField
          id="pg-baseline"
          label="Baseline"
          value={baseline}
          placeholder="42"
          invalid={numericInvalid || sameValue}
          onChange={onBaseline}
        />
        <NumericField
          id="pg-target"
          label="Target"
          value={target}
          placeholder="70"
          invalid={numericInvalid || sameValue}
          onChange={onTarget}
        />
        <div className="space-y-1.5">
          <Label htmlFor="pg-unit">
            Unit <span className="text-destructive">*</span>
          </Label>
          <UnitCombobox value={unit} onChange={onUnit} />
        </div>
        <div className="space-y-1.5">
          <Label>Direction</Label>
          <div className="grid grid-cols-2 gap-1 rounded-lg border border-border p-0.5">
            <DirectionOption
              active={direction === "Increase"}
              icon={TrendingUp}
              label="Increase"
              onClick={() => onDirection("Increase")}
            />
            <DirectionOption
              active={direction === "Decrease"}
              icon={TrendingDown}
              label="Decrease"
              onClick={() => onDirection("Decrease")}
            />
          </div>
        </div>
      </div>
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
    </div>
  );
}

/** Unit picker: a live text field with common-unit suggestions that still accepts any custom unit. */
function UnitCombobox({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <Autocomplete
      items={UNIT_OPTIONS}
      value={value}
      onValueChange={onChange}
      // Show every common unit on focus (empty query), then narrow as the user types — the default
      // filter hides the whole list until there's input, which leaves an empty popup on open.
      filter={(item, query) => {
        const q = query.trim().toLowerCase();
        return q === "" || String(item).toLowerCase().includes(q);
      }}
      open={open}
      onOpenChange={setOpen}
    >
      <ComboboxInput
        id="pg-unit"
        placeholder="Percent (%)"
        className="w-full"
      />
      <ComboboxContent className="pointer-events-auto">
        <ComboboxEmpty>Uses “{value.trim()}” as a custom unit.</ComboboxEmpty>
        {/* Function child: Base UI filters `items` by the input and renders only the matches,
            which is also what registers each item for highlight and click/keyboard selection. */}
        <ComboboxList>
          {(u: string) => (
            <ComboboxItem key={u} value={u}>
              {u}
            </ComboboxItem>
          )}
        </ComboboxList>
      </ComboboxContent>
    </Autocomplete>
  );
}

function NumericField({
  id,
  label,
  value,
  placeholder,
  invalid,
  onChange,
}: {
  id: string;
  label: string;
  value: string;
  placeholder: string;
  invalid: boolean;
  onChange: (v: string) => void;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>
        {label} <span className="text-destructive">*</span>
      </Label>
      <Input
        id={id}
        inputMode="decimal"
        value={value}
        placeholder={placeholder}
        aria-invalid={invalid}
        onChange={(e) => onChange(e.target.value)}
        className="tabular-nums"
      />
    </div>
  );
}

function DirectionOption({
  active,
  icon: Icon,
  label,
  onClick,
}: {
  active: boolean;
  icon: typeof TrendingUp;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "flex h-8 items-center justify-center gap-1.5 rounded-md px-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        active
          ? "bg-primary/10 text-primary"
          : "text-muted-foreground hover:text-foreground"
      )}
    >
      <Icon className="size-4 shrink-0" aria-hidden />
      {label}
    </button>
  );
}

// ── Selected organizational objective (rich trigger content) ─────────────────────────

function TargetSummary({ target }: { target: AlignmentTargetDto }) {
  const scope =
    target.ownershipScope === "Company"
      ? "Company strategy"
      : (target.orgUnitName ?? "Organizational");
  const lineage = lineageLabel(target);
  return (
    <span className="flex min-w-0 flex-col gap-0.5">
      <span className="type-eyebrow text-muted-foreground">{scope}</span>
      <span className="font-semibold text-foreground">{target.title}</span>
      {lineage ? (
        <span className="text-xs text-muted-foreground">{lineage}</span>
      ) : null}
    </span>
  );
}

/** One objective option in the selector — title with its owning unit (or upstream lineage) beneath. */
function TargetOption({ target }: { target: AlignmentTargetDto }) {
  const context =
    target.ownershipScope === "Company"
      ? lineageLabel(target)
      : (target.orgUnitName ?? lineageLabel(target));
  return (
    <SelectItem value={target.id} className="py-2">
      <span className="flex flex-col gap-0.5">
        <span className="font-medium text-foreground">{target.title}</span>
        {context ? (
          <span className="text-xs text-muted-foreground">{context}</span>
        ) : null}
      </span>
    </SelectItem>
  );
}

/** The upstream direction above a target — its objective ancestry, top-down, excluding the target itself. */
function lineageLabel(target: AlignmentTargetDto): string {
  return target.directionPath.slice(0, -1).join(" › ");
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}
