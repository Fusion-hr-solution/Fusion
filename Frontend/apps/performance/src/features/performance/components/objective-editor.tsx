"use client";

import { useEffect, useMemo, useState } from "react";
import { ArrowRight, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import type {
  CycleSummaryDto,
  ImprovementDirection,
  MeasurementInput,
  MeasurementMethod,
  StrategicObjectiveDto,
} from "@repo/api";
import { Button } from "@repo/ds/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@repo/ds/components/ui/dialog";
import { Input } from "@repo/ds/components/ui/input";
import { Label } from "@repo/ds/components/ui/label";
import { Textarea } from "@repo/ds/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@repo/ds/components/ui/select";
import { AsyncButton } from "@repo/ds/shell";
import { cn } from "@repo/ds/lib/utils";
import { MEASUREMENT_LABELS, parseNumeric } from "../lib";
import { EmployeePicker, type PickedEmployee } from "@repo/workforce-ui";

interface MilestoneRow {
  title: string;
  weight: string;
}

export interface ObjectiveDraft {
  title: string;
  description: string;
  accountablePersonId: string;
  startDate: string;
  endDate: string;
  measurement: MeasurementInput;
}

export function ObjectiveEditor({
  open,
  onOpenChange,
  cycle,
  objective,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  cycle: CycleSummaryDto;
  objective?: StrategicObjectiveDto;
  onSubmit: (draft: ObjectiveDraft) => Promise<void>;
}) {
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
  const [milestones, setMilestones] = useState<MilestoneRow[]>([{ title: "", weight: "" }]);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) return;
    setTitle(objective?.title ?? "");
    setDescription(objective?.description ?? "");
    setPerson(
      objective
        ? { id: objective.accountablePersonId, name: objective.accountablePersonName ?? "Objective owner" }
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
    setMilestones(
      m?.milestones && m.milestones.length > 0
        ? m.milestones.map((milestone) => ({ title: milestone.title, weight: String(milestone.weight) }))
        : [{ title: "", weight: "" }]
    );
  }, [open, objective, cycle]);

  const base = parseNumeric(baseline);
  const tgt = parseNumeric(target);
  const numericInvalid = base.invalid || tgt.invalid;
  const sameValue = base.num !== null && tgt.num !== null && base.num === tgt.num;
  const weightSum = milestones.reduce((total, row) => total + (Number(row.weight) || 0), 0);

  const numericValid =
    method !== "NumericTarget" ||
    (base.num !== null && tgt.num !== null && unit.trim() !== "" && !sameValue);
  const milestonesValid =
    method !== "WeightedMilestones" ||
    (milestones.every((row) => row.title.trim() !== "" && Number(row.weight) > 0) && weightSum === 100);
  const valid =
    title.trim() !== "" && person !== null && endDate > startDate && numericValid && milestonesValid;

  const preview = useMemo(() => {
    if (method === "NumericTarget") {
      const arrow = direction === "Decrease" ? "↓" : "→";
      return `${baseline || "?"} ${arrow} ${target || "?"} ${unit}`.trim();
    }
    if (method === "WeightedMilestones") {
      const named = milestones.filter((row) => row.title.trim() !== "").length;
      return `${named} milestone${named === 1 ? "" : "s"} · ${weightSum}%`;
    }
    return "Manual completion %";
  }, [method, baseline, target, unit, direction, milestones, weightSum]);

  function buildMeasurement(): MeasurementInput {
    if (method === "NumericTarget") {
      return { method, baseline: base.num ?? 0, target: tgt.num ?? 0, unit: unit.trim(), direction };
    }
    if (method === "WeightedMilestones") {
      return {
        method,
        milestones: milestones.map((row) => ({ title: row.title.trim(), weight: Number(row.weight) })),
      };
    }
    return { method: "ManualPercentage" };
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-4xl">
        <DialogHeader>
          <DialogTitle>{objective ? "Edit strategic objective" : "New strategic objective"}</DialogTitle>
          <DialogDescription>
            Company direction for {cycle.name}. Draft now, publish when it is ready to cascade.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-x-8 gap-y-5 py-1 md:grid-cols-[1.05fr_1fr]">
          {/* Definition */}
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="obj-title">Objective</Label>
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
                Rationale <span className="font-normal text-muted-foreground">(optional)</span>
              </Label>
              <Textarea
                id="obj-desc"
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                rows={3}
                placeholder="The outcome this direction commits the company to."
              />
            </div>
            <div className="space-y-1.5">
              <Label>Objective owner</Label>
              <EmployeePicker value={person} onChange={setPerson} />
              <p className="text-xs text-muted-foreground">
                Owns this outcome and its downstream decisions.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="obj-start">From</Label>
                <Input
                  id="obj-start"
                  type="date"
                  value={startDate}
                  min={cycle.startDate}
                  max={cycle.endDate}
                  onChange={(event) => setStartDate(event.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="obj-end">To</Label>
                <Input
                  id="obj-end"
                  type="date"
                  value={endDate}
                  min={cycle.startDate}
                  max={cycle.endDate}
                  onChange={(event) => setEndDate(event.target.value)}
                />
              </div>
            </div>
          </div>

          {/* Measurement */}
          <div className="space-y-4 md:border-l md:border-border/60 md:pl-8">
            <div className="space-y-1.5">
              <Label>How progress is measured</Label>
              <Select value={method} onValueChange={(next) => setMethod(next as MeasurementMethod)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(Object.keys(MEASUREMENT_LABELS) as MeasurementMethod[]).map((key) => (
                    <SelectItem key={key} value={key}>
                      {MEASUREMENT_LABELS[key]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {method === "NumericTarget" ? (
              <div className="space-y-3">
                <div className="grid grid-cols-[1fr_auto_1fr] items-end gap-2.5">
                  <div className="space-y-1.5">
                    <Label htmlFor="obj-baseline">Baseline</Label>
                    <Input
                      id="obj-baseline"
                      inputMode="decimal"
                      value={baseline}
                      onChange={(event) => setBaseline(event.target.value)}
                      placeholder="45"
                      aria-invalid={base.invalid}
                    />
                  </div>
                  <ArrowRight className="mb-2.5 size-4 text-muted-foreground" aria-hidden />
                  <div className="space-y-1.5">
                    <Label htmlFor="obj-target">Target</Label>
                    <Input
                      id="obj-target"
                      inputMode="decimal"
                      value={target}
                      onChange={(event) => setTarget(event.target.value)}
                      placeholder="75"
                      aria-invalid={tgt.invalid}
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="obj-unit">Unit</Label>
                    <Input
                      id="obj-unit"
                      value={unit}
                      onChange={(event) => setUnit(event.target.value)}
                      placeholder="%, k€, NPS…"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Direction</Label>
                    <Select value={direction} onValueChange={(next) => setDirection(next as ImprovementDirection)}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Increase">Higher is better</SelectItem>
                        <SelectItem value="Decrease">Lower is better</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                {numericInvalid ? (
                  <p className="text-sm text-destructive">
                    Enter a number — put units like M€ or % in the Unit field.
                  </p>
                ) : sameValue ? (
                  <p className="text-sm text-destructive">Baseline and target must differ.</p>
                ) : null}
              </div>
            ) : null}

            {method === "WeightedMilestones" ? (
              <div className="space-y-2.5">
                {milestones.map((row, index) => (
                  <div key={index} className="flex items-center gap-2.5">
                    <span className="w-5 shrink-0 text-sm tabular-nums text-muted-foreground">
                      {index + 1}
                    </span>
                    <Input
                      value={row.title}
                      onChange={(event) =>
                        setMilestones((rows) =>
                          rows.map((item, i) => (i === index ? { ...item, title: event.target.value } : item))
                        )
                      }
                      placeholder={`Milestone ${index + 1}`}
                      className="flex-1"
                    />
                    <div className="relative w-24 shrink-0">
                      <Input
                        type="number"
                        value={row.weight}
                        onChange={(event) =>
                          setMilestones((rows) =>
                            rows.map((item, i) => (i === index ? { ...item, weight: event.target.value } : item))
                          )
                        }
                        placeholder="0"
                        className="pr-7 text-right"
                      />
                      <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                        %
                      </span>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      onClick={() =>
                        setMilestones((rows) => (rows.length > 1 ? rows.filter((_, i) => i !== index) : rows))
                      }
                      disabled={milestones.length === 1}
                      aria-label={`Remove milestone ${index + 1}`}
                    >
                      <Trash2 className="size-3.5" />
                    </Button>
                  </div>
                ))}
                <div className="flex items-center justify-between pt-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setMilestones((rows) => [...rows, { title: "", weight: "" }])}
                  >
                    <Plus className="size-3.5" data-icon="inline-start" /> Add milestone
                  </Button>
                  <span
                    className={cn(
                      "text-sm font-medium tabular-nums",
                      weightSum === 100
                        ? "text-success"
                        : weightSum > 100
                          ? "text-destructive"
                          : "text-muted-foreground"
                    )}
                  >
                    {weightSum}%
                    {weightSum === 100
                      ? " · balanced"
                      : weightSum > 100
                        ? ` · ${weightSum - 100} over`
                        : ` · ${100 - weightSum} left`}
                  </span>
                </div>
              </div>
            ) : null}

            {method === "ManualPercentage" ? (
              <p className="text-sm text-muted-foreground">
                A single completion percentage the objective owner keeps up to date.
              </p>
            ) : null}

            <div className="rounded-xl border border-border/70 bg-muted/30 px-3.5 py-2.5">
              <p className="type-eyebrow text-muted-foreground">Outcome</p>
              <p className="mt-0.5 text-sm font-medium tabular-nums text-foreground">{preview}</p>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={submitting}>
            Cancel
          </Button>
          <AsyncButton
            pending={submitting}
            disabled={!valid}
            onClick={async () => {
              setSubmitting(true);
              try {
                await onSubmit({
                  title: title.trim(),
                  description: description.trim(),
                  accountablePersonId: person!.id,
                  startDate,
                  endDate,
                  measurement: buildMeasurement(),
                });
                onOpenChange(false);
              } catch (error) {
                toast.error(error instanceof Error ? error.message : "Could not save the objective.");
              } finally {
                setSubmitting(false);
              }
            }}
          >
            {objective ? "Save objective" : "Add to direction"}
          </AsyncButton>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
