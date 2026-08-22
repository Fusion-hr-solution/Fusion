"use client";

import { useEffect, useMemo, useState } from "react";
import { ChevronRight, Link2, Plus, Trash2, Unlink } from "lucide-react";
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
import { Input } from "@repo/ds/components/ui/input";
import { Label } from "@repo/ds/components/ui/label";
import { Textarea } from "@repo/ds/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@repo/ds/components/ui/select";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@repo/ds/components/ui/sheet";
import { AsyncButton } from "@repo/ds/shell";
import { cn } from "@repo/ds/lib/utils";
import { MEASUREMENT_METHOD_LABEL } from "./plan-lib";

interface MilestoneRow {
  title: string;
  weight: string;
}

type AlignMode = "aligned" | "standalone";

/**
 * The Goal Composer for an employee plan objective. It keeps the plan's purpose in view: the
 * author first says whether the objective supports upstream direction or is a standalone role
 * objective, and when aligned the chosen direction path stays visible. The measurement editor
 * changes with the method rather than showing every field at once, and the plan weight is captured
 * here while the running total lives on the plan's weight summary.
 */
export function PlanGoalComposer({
  open,
  onOpenChange,
  targets,
  standaloneAllowed,
  objective,
  onCreate,
  onUpdate,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  targets: AlignmentTargetDto[];
  standaloneAllowed: boolean;
  objective?: PlanObjectiveDto;
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

  const weightSum = milestones.reduce((sum, row) => sum + (Number(row.weight) || 0), 0);
  const numericValid =
    method !== "NumericTarget" ||
    (baseline !== "" && target !== "" && unit.trim() !== "" && Number(baseline) !== Number(target));
  const milestonesValid =
    method !== "WeightedMilestones" ||
    (milestones.every((row) => row.title.trim() !== "" && Number(row.weight) > 0) && weightSum === 100);
  const weightNum = Number(weight);
  const alignValid = mode === "standalone" || parentId !== "";
  const valid =
    title.trim() !== "" && alignValid && weightNum > 0 && weightNum <= 100 && numericValid && milestonesValid;

  function buildMeasurement(): MeasurementInput {
    if (method === "NumericTarget")
      return { method, baseline: Number(baseline), target: Number(target), unit: unit.trim(), direction };
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
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="flex w-full flex-col gap-0 overflow-y-auto p-0 sm:max-w-xl">
        <SheetHeader className="border-b p-6">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">My plan</p>
          <SheetTitle className="mt-1">{isEdit ? "Edit objective" : "Add objective"}</SheetTitle>
          <SheetDescription className="sr-only">
            Author an objective in your plan, aligned to direction or as a standalone role objective.
          </SheetDescription>
        </SheetHeader>

        <div className="flex-1 space-y-5 p-6">
          {/* Alignment choice — the objective's relationship to direction leads. */}
          <div className="space-y-2">
            <Label>How it connects</Label>
            <div className={cn("grid gap-2", standaloneAllowed ? "grid-cols-2" : "grid-cols-1")}>
              <ModeOption
                active={mode === "aligned"}
                icon={Link2}
                title="Aligned to direction"
                detail="Supports a strategic or organizational objective"
                onClick={() => setMode("aligned")}
              />
              {standaloneAllowed ? (
                <ModeOption
                  active={mode === "standalone"}
                  icon={Unlink}
                  title="Standalone role objective"
                  detail="Part of your role, not tied to direction"
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
                  <nav className="flex flex-wrap items-center gap-1 rounded-lg bg-muted/40 px-3 py-2 text-xs text-muted-foreground" aria-label="Direction">
                    {selectedTarget.directionPath.map((label, index) => (
                      <span key={index} className="flex items-center gap-1">
                        {index > 0 ? <ChevronRight className="size-3 opacity-60" aria-hidden /> : null}
                        <span className={cn(index === selectedTarget.directionPath.length - 1 && "font-medium text-foreground")}>
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
            <Input id="pg-title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Reduce escalation time" autoFocus />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="pg-desc">
              Detail <span className="text-muted-foreground">(optional)</span>
            </Label>
            <Textarea id="pg-desc" value={description} onChange={(e) => setDescription(e.target.value)} rows={2} />
          </div>

          {/* Measurement — the editor changes with the method. */}
          <div className="space-y-3 rounded-xl border p-4">
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

            {method === "NumericTarget" ? (
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="pg-base">Baseline</Label>
                  <Input id="pg-base" type="number" value={baseline} onChange={(e) => setBaseline(e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="pg-target">Target</Label>
                  <Input id="pg-target" type="number" value={target} onChange={(e) => setTarget(e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="pg-unit">Unit</Label>
                  <Input id="pg-unit" value={unit} onChange={(e) => setUnit(e.target.value)} placeholder="%, hours, NPS…" />
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
                      onChange={(e) => setMilestones((rows) => rows.map((item, i) => (i === index ? { ...item, title: e.target.value } : item)))}
                      placeholder={`Milestone ${index + 1}`}
                      className="flex-1"
                    />
                    <Input
                      type="number"
                      value={row.weight}
                      onChange={(e) => setMilestones((rows) => rows.map((item, i) => (i === index ? { ...item, weight: e.target.value } : item)))}
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
              <p className="text-sm text-muted-foreground">You will update a single completion percentage.</p>
            ) : null}
          </div>

          {/* Plan weight for this objective. */}
          <div className="space-y-1.5">
            <Label htmlFor="pg-weight">Plan weight</Label>
            <div className="flex items-center gap-2">
              <Input
                id="pg-weight"
                type="number"
                value={weight}
                onChange={(e) => setWeight(e.target.value)}
                className="w-28"
                min={1}
                max={100}
              />
              <span className="text-sm text-muted-foreground">% of your plan</span>
            </div>
          </div>
        </div>

        <div className="sticky bottom-0 flex justify-end gap-2 border-t bg-background p-4">
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={submitting}>
            Cancel
          </Button>
          <AsyncButton pending={submitting} disabled={!valid} onClick={handleSubmit}>
            {isEdit ? "Save objective" : "Add to plan"}
          </AsyncButton>
        </div>
      </SheetContent>
    </Sheet>
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
        active ? "border-primary bg-primary/[0.05]" : "hover:border-primary/40 hover:bg-muted/40"
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
