"use client";

import { useEffect, useMemo, useState } from "react";
import { ArrowRight, ChevronRight, Link2, Plus, Trash2, Unlink } from "lucide-react";
import { toast } from "sonner";
import type {
  AddPlanObjectiveRequest,
  AlignmentTargetDto,
  ImprovementDirection,
  MeasurementInput,
  MeasurementMethod,
  PlanObjectiveDto,
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@repo/ds/components/ui/select";
import { AsyncButton } from "@repo/ds/shell";
import { cn } from "@repo/ds/lib/utils";
import { parseNumeric } from "../../lib";
import { MEASUREMENT_METHOD_LABEL, pct, weightTone } from "./plan-lib";

interface MilestoneRow {
  title: string;
  weight: string;
}

type AlignMode = "aligned" | "standalone";

/**
 * The Goal Composer for an employee plan objective. The author first chooses whether the
 * objective supports upstream direction or is a standalone role objective; when aligned, the
 * chosen direction path stays visible. Measurement has room to breathe, and the plan-weight field
 * shows how this objective moves the plan's running total toward 100% before it is added.
 */
export function PlanGoalComposer({
  open,
  onOpenChange,
  targets,
  standaloneAllowed,
  objective,
  otherWeightTotal,
  onCreate,
  onUpdate,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  targets: AlignmentTargetDto[];
  standaloneAllowed: boolean;
  objective?: PlanObjectiveDto;
  /** Combined weight of the plan's other objectives, so the projected total can be shown. */
  otherWeightTotal: number;
  onCreate: (request: AddPlanObjectiveRequest) => Promise<void>;
  onUpdate: (request: AddPlanObjectiveRequest) => Promise<void>;
}) {
  const isEdit = Boolean(objective);

  const [mode, setMode] = useState<AlignMode>("aligned");
  const [parentId, setParentId] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [method, setMethod] = useState<MeasurementMethod>("NumericTarget");
  const [baseline, setBaseline] = useState("");
  const [target, setTarget] = useState("");
  const [unit, setUnit] = useState("");
  const [direction, setDirection] = useState<ImprovementDirection>("Increase");
  const [milestones, setMilestones] = useState<MilestoneRow[]>([{ title: "", weight: "" }]);
  const [weight, setWeight] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) return;
    setMode(objective ? (objective.isAligned ? "aligned" : "standalone") : "aligned");
    setParentId(objective?.parentObjectiveId ?? "");
    setTitle(objective?.title ?? "");
    setDescription(objective?.description ?? "");
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
    setWeight(objective?.planWeight != null ? String(objective.planWeight) : "");
  }, [open, objective]);

  const selectedTarget = useMemo(() => targets.find((t) => t.id === parentId) ?? null, [targets, parentId]);

  const base = parseNumeric(baseline);
  const tgt = parseNumeric(target);
  const numericInvalid = base.invalid || tgt.invalid;
  const sameValue = base.num !== null && tgt.num !== null && base.num === tgt.num;
  const milestoneSum = milestones.reduce((sum, row) => sum + (Number(row.weight) || 0), 0);

  const numericValid =
    method !== "NumericTarget" || (base.num !== null && tgt.num !== null && unit.trim() !== "" && !sameValue);
  const milestonesValid =
    method !== "WeightedMilestones" ||
    (milestones.every((row) => row.title.trim() !== "" && Number(row.weight) > 0) && milestoneSum === 100);
  const weightNum = Number(weight) || 0;
  const alignValid = mode === "standalone" || parentId !== "";
  const valid =
    title.trim() !== "" && alignValid && weightNum > 0 && weightNum <= 100 && numericValid && milestonesValid;

  const projectedTotal = otherWeightTotal + weightNum;
  const projectedTone = weightTone(projectedTotal);

  function buildMeasurement(): MeasurementInput {
    if (method === "NumericTarget")
      return { method, baseline: base.num ?? 0, target: tgt.num ?? 0, unit: unit.trim(), direction };
    if (method === "WeightedMilestones")
      return { method, milestones: milestones.map((row) => ({ title: row.title.trim(), weight: Number(row.weight) })) };
    return { method: "ManualPercentage" };
  }

  async function handleSubmit() {
    setSubmitting(true);
    try {
      const request: AddPlanObjectiveRequest = {
        title: title.trim(),
        description: description.trim() || null,
        parentObjectiveId: mode === "aligned" ? parentId : null,
        measurement: buildMeasurement(),
        planWeight: weightNum,
      };
      if (isEdit) await onUpdate(request);
      else await onCreate(request);
      onOpenChange(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not save the objective.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-4xl">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit objective" : "Add objective"}</DialogTitle>
          <DialogDescription className="sr-only">
            Author an objective in your plan, aligned to direction or as a standalone role objective.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-x-8 gap-y-5 py-1 md:grid-cols-[1.05fr_1fr]">
          {/* Definition + alignment */}
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>How it connects</Label>
              <div className={cn("grid gap-2", standaloneAllowed ? "grid-cols-2" : "grid-cols-1")}>
                <ModeOption
                  active={mode === "aligned"}
                  icon={Link2}
                  title="Aligned to direction"
                  detail="Supports an upstream objective"
                  onClick={() => setMode("aligned")}
                />
                {standaloneAllowed ? (
                  <ModeOption
                    active={mode === "standalone"}
                    icon={Unlink}
                    title="Standalone"
                    detail="Part of your role"
                    onClick={() => setMode("standalone")}
                  />
                ) : null}
              </div>

              {mode === "aligned" ? (
                <div className="space-y-2 pt-1">
                  <Select value={parentId} onValueChange={setParentId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Choose the objective this supports" />
                    </SelectTrigger>
                    <SelectContent>
                      {targets.map((t) => (
                        <SelectItem key={t.id} value={t.id}>
                          {t.title}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {selectedTarget ? (
                    <nav
                      className="flex flex-wrap items-center gap-1 rounded-lg bg-muted/40 px-3 py-2 text-xs text-muted-foreground"
                      aria-label="Direction path"
                    >
                      {selectedTarget.directionPath.map((label, index) => (
                        <span key={index} className="flex items-center gap-1">
                          {index > 0 ? <ChevronRight className="size-3 opacity-60" aria-hidden /> : null}
                          <span
                            className={cn(
                              index === selectedTarget.directionPath.length - 1 && "font-medium text-foreground"
                            )}
                          >
                            {label}
                          </span>
                        </span>
                      ))}
                    </nav>
                  ) : null}
                </div>
              ) : null}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="pg-title">Objective</Label>
              <Input
                id="pg-title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Reduce escalation time"
                autoFocus
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="pg-desc">
                Detail <span className="font-normal text-muted-foreground">(optional)</span>
              </Label>
              <Textarea id="pg-desc" value={description} onChange={(e) => setDescription(e.target.value)} rows={3} />
            </div>
          </div>

          {/* Measurement + weight */}
          <div className="space-y-4 md:border-l md:border-border/60 md:pl-8">
            <div className="space-y-1.5">
              <Label>How you will measure it</Label>
              <Select value={method} onValueChange={(next) => setMethod(next as MeasurementMethod)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(Object.keys(MEASUREMENT_METHOD_LABEL) as MeasurementMethod[]).map((key) => (
                    <SelectItem key={key} value={key}>
                      {MEASUREMENT_METHOD_LABEL[key]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {method === "NumericTarget" ? (
              <div className="space-y-3">
                <div className="grid grid-cols-[1fr_auto_1fr] items-end gap-2.5">
                  <div className="space-y-1.5">
                    <Label htmlFor="pg-base">Baseline</Label>
                    <Input
                      id="pg-base"
                      inputMode="decimal"
                      value={baseline}
                      onChange={(e) => setBaseline(e.target.value)}
                      placeholder="40"
                      aria-invalid={base.invalid}
                    />
                  </div>
                  <ArrowRight className="mb-2.5 size-4 text-muted-foreground" aria-hidden />
                  <div className="space-y-1.5">
                    <Label htmlFor="pg-target">Target</Label>
                    <Input
                      id="pg-target"
                      inputMode="decimal"
                      value={target}
                      onChange={(e) => setTarget(e.target.value)}
                      placeholder="70"
                      aria-invalid={tgt.invalid}
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="pg-unit">Unit</Label>
                    <Input
                      id="pg-unit"
                      value={unit}
                      onChange={(e) => setUnit(e.target.value)}
                      placeholder="%, hours, NPS…"
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
                    Enter a number — put units like hours or % in the Unit field.
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
                    <span className="w-5 shrink-0 text-sm tabular-nums text-muted-foreground">{index + 1}</span>
                    <Input
                      value={row.title}
                      onChange={(e) =>
                        setMilestones((rows) => rows.map((item, i) => (i === index ? { ...item, title: e.target.value } : item)))
                      }
                      placeholder={`Milestone ${index + 1}`}
                      className="flex-1"
                    />
                    <div className="relative w-24 shrink-0">
                      <Input
                        type="number"
                        value={row.weight}
                        onChange={(e) =>
                          setMilestones((rows) => rows.map((item, i) => (i === index ? { ...item, weight: e.target.value } : item)))
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
                      onClick={() => setMilestones((rows) => (rows.length > 1 ? rows.filter((_, i) => i !== index) : rows))}
                      disabled={milestones.length === 1}
                      aria-label={`Remove milestone ${index + 1}`}
                    >
                      <Trash2 className="size-3.5" />
                    </Button>
                  </div>
                ))}
                <div className="flex items-center justify-between pt-1">
                  <Button variant="ghost" size="sm" onClick={() => setMilestones((rows) => [...rows, { title: "", weight: "" }])}>
                    <Plus className="size-3.5" data-icon="inline-start" /> Add milestone
                  </Button>
                  <span
                    className={cn(
                      "text-sm font-medium tabular-nums",
                      milestoneSum === 100 ? "text-success" : milestoneSum > 100 ? "text-destructive" : "text-muted-foreground"
                    )}
                  >
                    {milestoneSum}%
                    {milestoneSum === 100 ? " · balanced" : milestoneSum > 100 ? " · over" : ` · ${100 - milestoneSum} left`}
                  </span>
                </div>
              </div>
            ) : null}

            {method === "ManualPercentage" ? (
              <p className="text-sm text-muted-foreground">You will update a single completion percentage.</p>
            ) : null}

            {/* Plan weight — with the projected plan total. */}
            <div className="space-y-1.5 border-t border-border/60 pt-4">
              <Label htmlFor="pg-weight">Plan weight</Label>
              <div className="flex items-center gap-2">
                <div className="relative w-28">
                  <Input
                    id="pg-weight"
                    type="number"
                    value={weight}
                    onChange={(e) => setWeight(e.target.value)}
                    className="pr-7 text-right"
                    min={1}
                    max={100}
                    placeholder="0"
                  />
                  <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                    %
                  </span>
                </div>
                <span className="text-sm text-muted-foreground">of your plan</span>
              </div>
              {weightNum > 0 ? (
                <p className="text-xs text-muted-foreground">
                  Plan total becomes{" "}
                  <span
                    className={cn(
                      "font-medium tabular-nums",
                      projectedTone === "success"
                        ? "text-success"
                        : projectedTone === "danger"
                          ? "text-destructive"
                          : "text-foreground"
                    )}
                  >
                    {pct(projectedTotal)}%
                  </span>{" "}
                  of 100%.
                </p>
              ) : null}
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={submitting}>
            Cancel
          </Button>
          <AsyncButton pending={submitting} disabled={!valid} onClick={handleSubmit}>
            {isEdit ? "Save objective" : "Add to plan"}
          </AsyncButton>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ModeOption({
  active,
  icon: Icon,
  title,
  detail,
  onClick,
}: {
  active: boolean;
  icon: typeof Link2;
  title: string;
  detail: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex flex-col gap-1 rounded-lg border p-3 text-left transition-colors",
        active ? "border-primary bg-primary/[0.05]" : "border-border hover:border-primary/40 hover:bg-muted/40"
      )}
      aria-pressed={active}
    >
      <span className="flex items-center gap-1.5 text-sm font-medium">
        <Icon className={cn("size-4", active ? "text-primary" : "text-muted-foreground")} aria-hidden /> {title}
      </span>
      <span className="text-xs text-muted-foreground">{detail}</span>
    </button>
  );
}
