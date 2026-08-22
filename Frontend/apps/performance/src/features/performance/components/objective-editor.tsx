"use client";

import { useEffect, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
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
import { MEASUREMENT_LABELS } from "../lib";
import { EmployeePicker, type PickedEmployee } from "./employee-picker";

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
      objective ? { id: objective.accountablePersonId, name: objective.accountablePersonName ?? "Accountable person" } : null
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

  const weightSum = milestones.reduce((total, row) => total + (Number(row.weight) || 0), 0);
  const numericValid =
    method !== "NumericTarget" || (baseline !== "" && target !== "" && unit.trim() !== "" && Number(baseline) !== Number(target));
  const milestonesValid =
    method !== "WeightedMilestones" ||
    (milestones.every((row) => row.title.trim() !== "" && Number(row.weight) > 0) && weightSum === 100);
  const valid = title.trim() !== "" && person !== null && endDate > startDate && numericValid && milestonesValid;

  function buildMeasurement(): MeasurementInput {
    if (method === "NumericTarget") {
      return { method, baseline: Number(baseline), target: Number(target), unit: unit.trim(), direction };
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
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{objective ? "Edit strategic objective" : "New strategic objective"}</DialogTitle>
          <DialogDescription>Company direction for {cycle.name}. Draft now, publish when it is ready to cascade.</DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-1">
          <div className="space-y-1.5">
            <Label htmlFor="obj-title">Objective</Label>
            <Input id="obj-title" value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Grow recurring revenue" autoFocus />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="obj-desc">Why it matters <span className="text-muted-foreground">(optional)</span></Label>
            <Textarea id="obj-desc" value={description} onChange={(event) => setDescription(event.target.value)} rows={2} placeholder="The outcome this direction commits the company to." />
          </div>
          <div className="space-y-1.5">
            <Label>Accountable person</Label>
            <EmployeePicker value={person} onChange={setPerson} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="obj-start">From</Label>
              <Input id="obj-start" type="date" value={startDate} min={cycle.startDate} max={cycle.endDate} onChange={(event) => setStartDate(event.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="obj-end">To</Label>
              <Input id="obj-end" type="date" value={endDate} min={cycle.startDate} max={cycle.endDate} onChange={(event) => setEndDate(event.target.value)} />
            </div>
          </div>

          <div className="space-y-3 rounded-xl border bg-muted/20 p-4">
            <div className="space-y-1.5">
              <Label>How progress is measured</Label>
              <Select value={method} onValueChange={(next) => setMethod(next as MeasurementMethod)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {(Object.keys(MEASUREMENT_LABELS) as MeasurementMethod[]).map((key) => (
                    <SelectItem key={key} value={key}>{MEASUREMENT_LABELS[key]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {method === "NumericTarget" ? (
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="obj-baseline">Baseline</Label>
                  <Input id="obj-baseline" type="number" value={baseline} onChange={(event) => setBaseline(event.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="obj-target">Target</Label>
                  <Input id="obj-target" type="number" value={target} onChange={(event) => setTarget(event.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="obj-unit">Unit</Label>
                  <Input id="obj-unit" value={unit} onChange={(event) => setUnit(event.target.value)} placeholder="k€, %, NPS…" />
                </div>
                <div className="space-y-1.5">
                  <Label>Direction</Label>
                  <Select value={direction} onValueChange={(next) => setDirection(next as ImprovementDirection)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Increase">Higher is better</SelectItem>
                      <SelectItem value="Decrease">Lower is better</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {baseline !== "" && target !== "" && Number(baseline) === Number(target) ? (
                  <p className="col-span-2 text-sm text-destructive">Baseline and target must differ.</p>
                ) : null}
              </div>
            ) : null}

            {method === "WeightedMilestones" ? (
              <div className="space-y-2">
                {milestones.map((row, index) => (
                  <div key={index} className="flex items-center gap-2">
                    <Input
                      value={row.title}
                      onChange={(event) =>
                        setMilestones((rows) => rows.map((item, i) => (i === index ? { ...item, title: event.target.value } : item)))
                      }
                      placeholder={`Milestone ${index + 1}`}
                      className="flex-1"
                    />
                    <Input
                      type="number"
                      value={row.weight}
                      onChange={(event) =>
                        setMilestones((rows) => rows.map((item, i) => (i === index ? { ...item, weight: event.target.value } : item)))
                      }
                      placeholder="%"
                      className="w-20"
                    />
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => setMilestones((rows) => (rows.length > 1 ? rows.filter((_, i) => i !== index) : rows))}
                      aria-label="Remove milestone"
                    >
                      <Trash2 className="size-3.5" />
                    </Button>
                  </div>
                ))}
                <div className="flex items-center justify-between">
                  <Button variant="ghost" size="sm" onClick={() => setMilestones((rows) => [...rows, { title: "", weight: "" }])}>
                    <Plus className="size-3.5" data-icon="inline-start" /> Add milestone
                  </Button>
                  <span className={cn("text-sm font-medium tabular-nums", weightSum === 100 ? "text-success" : "text-warning")}>
                    {weightSum}% / 100%
                  </span>
                </div>
              </div>
            ) : null}

            {method === "ManualPercentage" ? (
              <p className="text-sm text-muted-foreground">Progress is a single completion percentage the accountable person updates.</p>
            ) : null}
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={submitting}>Cancel</Button>
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
