"use client";

import { useEffect, useMemo, useState } from "react";
import { UserRound } from "lucide-react";
import { toast } from "sonner";
import type {
  CycleSummaryDto,
  ImprovementDirection,
  MeasurementInput,
  MeasurementMethod,
  StrategicObjectiveDto,
} from "@repo/api";
import { Button } from "@repo/ds/components/ui/button";
import { DatePicker } from "@repo/ds/components/ui/date-picker";
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@repo/ds/components/ui/dialog";
import { Input } from "@repo/ds/components/ui/input";
import { Label } from "@repo/ds/components/ui/label";
import { Textarea } from "@repo/ds/components/ui/textarea";
import { AsyncButton } from "@repo/ds/shell";
import { EmployeePicker, type PickedEmployee } from "@repo/workforce-ui";
import { parseNumeric } from "../lib";
import { ObjectiveComposerSection } from "./objective-composer-section";
import { MeasurementEditor } from "./measurement/measurement-editor";
import {
  milestoneWeightSum,
  milestonesFromMeasurement,
  type MilestoneRow,
} from "./measurement/milestone-editor";

export interface ObjectiveDraft {
  title: string;
  description: string;
  accountablePersonId: string;
  startDate: string;
  endDate: string;
  measurement: MeasurementInput;
}

export type ObjectiveSubmissionIntent = "draft" | "publish";

/**
 * The Strategic (company) Objective composer — a root objective in the cascade: company scope, no
 * parent, an explicit accountable person, dates bounded by the Performance Cycle, and a Direct measure
 * only (manual percentage, numeric target, or weighted milestones). It shares the modern composer
 * grammar of {@link OrgObjectiveComposer} and {@link PlanGoalComposer} — sticky header, scrolling
 * numbered sections, sticky footer, and the shared {@link MeasurementEditor} — but keeps its own
 * lifecycle: the caller decides whether the completed objective should remain a Draft or publish as
 * company direction. Organization Goals makes publishing the deliberate default; older strategy
 * setup callers retain their draft-first flow.
 */
export function ObjectiveEditor({
  open,
  onOpenChange,
  cycle,
  objective,
  onSubmit,
  publishByDefault = false,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  cycle: CycleSummaryDto;
  objective?: StrategicObjectiveDto;
  onSubmit: (draft: ObjectiveDraft, intent: ObjectiveSubmissionIntent) => Promise<void>;
  /** Company-direction entry points can make publish the primary completed action. */
  publishByDefault?: boolean;
}) {
  const isEdit = Boolean(objective);
  const canPublish = publishByDefault && (!objective || objective.state === "Draft");

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [person, setPerson] = useState<PickedEmployee | null>(null);
  const [startDate, setStartDate] = useState(cycle.startDate);
  const [endDate, setEndDate] = useState(cycle.endDate);
  const [method, setMethod] = useState<MeasurementMethod>("NumericTarget");
  const [baseline, setBaseline] = useState("");
  const [target, setTarget] = useState("");
  const [unit, setUnit] = useState("");
  const [direction, setDirection] = useState<ImprovementDirection>("Increase");
  const [milestones, setMilestones] = useState<MilestoneRow[]>(() =>
    milestonesFromMeasurement(objective?.measurement)
  );
  const [submittingIntent, setSubmittingIntent] = useState<ObjectiveSubmissionIntent | null>(null);
  const submitting = submittingIntent !== null;

  // Reseed every time the modal opens (or the edited objective changes) so a reused instance never
  // shows a previous objective's values.
  useEffect(() => {
    if (!open) return;
    setTitle(objective?.title ?? "");
    setDescription(objective?.description ?? "");
    setPerson(
      objective
        ? {
            id: objective.accountablePersonId,
            name: objective.accountablePersonName ?? "Accountable person",
          }
        : null
    );
    setStartDate(objective?.startDate ?? cycle.startDate);
    setEndDate(objective?.endDate ?? cycle.endDate);
    const m = objective?.measurement;
    setMethod(m?.method ?? "NumericTarget");
    setBaseline(m?.baseline != null ? String(m.baseline) : "");
    setTarget(m?.target != null ? String(m.target) : "");
    setUnit(m?.unit ?? "");
    setDirection(m?.direction ?? "Increase");
    setMilestones(milestonesFromMeasurement(m));
  }, [open, objective, cycle]);

  const base = parseNumeric(baseline);
  const tgt = parseNumeric(target);
  const numericInvalid = base.invalid || tgt.invalid;
  const sameValue =
    base.num !== null && tgt.num !== null && base.num === tgt.num;
  const weightSum = milestoneWeightSum(milestones);

  // ── Readiness ──────────────────────────────────────────────────────────────
  // The same measurement contract the domain enforces, surfaced field-side by the shared editor:
  // a numeric measure needs a well-formed baseline and target that differ plus a unit; a milestone
  // measure needs every named row weighted and the weights totalling 100%.
  const numericComplete =
    base.num !== null &&
    tgt.num !== null &&
    !numericInvalid &&
    !sameValue &&
    unit.trim() !== "";
  const milestonesComplete =
    milestones.every(
      (row) =>
        row.title.trim() !== "" &&
        Number(row.weight) > 0 &&
        Number(row.weight) <= 100
    ) && weightSum === 100;
  const measurementValid =
    method === "ManualPercentage"
      ? true
      : method === "NumericTarget"
        ? numericComplete
        : milestonesComplete;

  const valid =
    title.trim() !== "" &&
    person !== null &&
    endDate > startDate &&
    measurementValid;

  const disabledReason = valid
    ? undefined
    : title.trim() === ""
      ? "Add a title first"
      : person === null
        ? "Choose an accountable person"
        : !(endDate > startDate)
          ? "The end date must be after the start date"
          : method === "NumericTarget"
            ? "Set a baseline, target, and unit for the measure"
            : method === "WeightedMilestones"
              ? "Give each milestone a weight totalling 100%"
              : "Complete the measurement";

  // A compact outcome readout, kept beside the measurement rather than in a standalone card.
  const preview = useMemo(() => {
    if (method === "NumericTarget") {
      const arrow = direction === "Decrease" ? "↓" : "→";
      return `${baseline || "?"} ${arrow} ${target || "?"} ${unit}`.trim();
    }
    if (method === "WeightedMilestones") {
      const named = milestones.filter((row) => row.title.trim() !== "").length;
      return `${named} milestone${named === 1 ? "" : "s"} · ${weightSum}%`;
    }
    return "Manual percentage";
  }, [method, baseline, target, unit, direction, milestones, weightSum]);

  function buildMeasurement(): MeasurementInput {
    if (method === "NumericTarget")
      return {
        method,
        baseline: base.num ?? 0,
        target: tgt.num ?? 0,
        unit: unit.trim(),
        direction,
      };
    if (method === "WeightedMilestones")
      return {
        method,
        milestones: milestones
          .filter((row) => row.title.trim() !== "")
          .map((row) => ({ title: row.title.trim(), weight: Number(row.weight) })),
      };
    return { method: "ManualPercentage" };
  }

  async function handleSubmit(intent: ObjectiveSubmissionIntent) {
    setSubmittingIntent(intent);
    try {
      await onSubmit({
        title: title.trim(),
        description: description.trim(),
        accountablePersonId: person!.id,
        startDate,
        endDate,
        measurement: buildMeasurement(),
      }, intent);
      onOpenChange(false);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Could not save the objective."
      );
    } finally {
      setSubmittingIntent(null);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[92vh] w-full flex-col gap-0 overflow-hidden p-0 sm:max-w-4xl">
        {/* Header — identity only; the numbered sections lead the scrolling body. */}
        <div className="border-b border-border px-6 py-5 pr-14">
          <DialogTitle>
            {isEdit ? "Edit strategic objective" : "New strategic objective"}
          </DialogTitle>
        </div>

        {/* Body — scrolls; header and footer stay put. */}
        <div className="flex-1 overflow-y-auto px-6 py-6">
          <div className="space-y-8">
            {/* 1. Objective definition */}
            <ObjectiveComposerSection n={1} title="Objective" bodyClassName="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="obj-title">
                  Title <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="obj-title"
                  value={title}
                  onChange={(event) => setTitle(event.target.value)}
                  placeholder="Grow recurring revenue"
                  autoFocus
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="obj-desc">
                  Description{" "}
                  <span className="font-normal text-muted-foreground">
                    (optional)
                  </span>
                </Label>
                <Textarea
                  id="obj-desc"
                  value={description}
                  onChange={(event) => setDescription(event.target.value)}
                  rows={2}
                  placeholder="The outcome this direction commits the company to."
                />
              </div>
            </ObjectiveComposerSection>

            {/* 2. Accountability */}
            <ObjectiveComposerSection n={2} title="Accountability" bodyClassName="space-y-4">
              <div className="space-y-1.5">
                <Label className="flex items-center gap-1.5">
                  <UserRound
                    className="size-3.5 text-muted-foreground"
                    aria-hidden
                  />
                  Accountable person <span className="text-destructive">*</span>
                </Label>
                <EmployeePicker value={person} onChange={setPerson} />
              </div>
            </ObjectiveComposerSection>

            {/* 3. Timeline — bounded by the cycle window. */}
            <ObjectiveComposerSection n={3} title="Timeline" bodyClassName="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="obj-start">Start</Label>
                  <DatePicker
                    id="obj-start"
                    value={startDate}
                    min={cycle.startDate}
                    max={endDate || cycle.endDate}
                    onChange={setStartDate}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="obj-end">End</Label>
                  <DatePicker
                    id="obj-end"
                    value={endDate}
                    min={startDate || cycle.startDate}
                    max={cycle.endDate}
                    onChange={setEndDate}
                  />
                </div>
              </div>
            </ObjectiveComposerSection>

            {/* 4. Measurement — the shared editor, with a compact outcome readout beneath. */}
            <ObjectiveComposerSection
              n={4}
              title="Measurement"
              hint="How will progress on this objective be measured?"
              bodyClassName="space-y-3"
            >
              <MeasurementEditor
                method={method}
                onMethodChange={setMethod}
                baseline={baseline}
                target={target}
                unit={unit}
                direction={direction}
                numericInvalid={numericInvalid}
                numericSameValue={sameValue}
                onBaseline={setBaseline}
                onTarget={setTarget}
                onUnit={setUnit}
                onDirection={setDirection}
                milestones={milestones}
                milestoneWeightSum={weightSum}
                onMilestonesChange={setMilestones}
              />
              <div className="flex items-center justify-between gap-3 rounded-xl border border-border/70 bg-muted/30 px-3.5 py-2.5">
                <span className="type-eyebrow text-muted-foreground">Outcome</span>
                <span className="truncate text-sm font-medium tabular-nums text-foreground">
                  {preview}
                </span>
              </div>
            </ObjectiveComposerSection>
          </div>
        </div>

        <div className="flex items-center justify-between gap-4 border-t border-border bg-muted/30 px-6 py-4">
          <Button
            variant="ghost"
            onClick={() => onOpenChange(false)}
            disabled={submitting}
          >
            Cancel
          </Button>
          <div className="flex items-center gap-2">
            {canPublish ? (
              <AsyncButton
                variant="outline"
                pending={submittingIntent === "draft"}
                disabled={!valid || submitting}
                onClick={() => handleSubmit("draft")}
                title={disabledReason}
              >
                Save draft
              </AsyncButton>
            ) : null}
            <AsyncButton
              pending={submittingIntent === (canPublish ? "publish" : "draft")}
              disabled={!valid || submitting}
              onClick={() => handleSubmit(canPublish ? "publish" : "draft")}
              title={disabledReason}
            >
              {canPublish ? "Publish direction" : isEdit ? "Save objective" : "Add to direction"}
            </AsyncButton>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
