"use client";

import { useEffect, useMemo, useState } from "react";
import { ArrowRight, ArrowUpRight, Calculator, Gauge, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import type {
  CreateOrganizationalObjectiveRequest,
  GoalDetailDto,
  GoalNodeDto,
  ImprovementDirection,
  MeasurementInput,
  MeasurementMethod,
  ObjectiveProgressSource,
  UpdateOrganizationalObjectiveRequest,
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
import { MEASUREMENT_LABELS, parseNumeric } from "../../lib";
import { EmployeePicker, type PickedEmployee } from "../employee-picker";
import { OrgUnitPicker, type PickedOrgUnit } from "./org-unit-picker";
import { scopeLabel } from "./goals-lib";

interface MilestoneRow {
  title: string;
  weight: string;
}

export function OrgObjectiveComposer({
  open,
  onOpenChange,
  parent,
  objective,
  defaultAccountable,
  onCreate,
  onUpdate,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  parent: GoalNodeDto;
  objective?: GoalDetailDto;
  /** Convenience default for a new objective's accountable person (the signed-in user); editable. */
  defaultAccountable?: PickedEmployee | null;
  onCreate: (request: CreateOrganizationalObjectiveRequest) => Promise<void>;
  onUpdate: (request: UpdateOrganizationalObjectiveRequest) => Promise<void>;
}) {
  const isEdit = Boolean(objective);
  const minDate = parent.startDate;
  const maxDate = parent.endDate;

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [person, setPerson] = useState<PickedEmployee | null>(null);
  const [orgUnit, setOrgUnit] = useState<PickedOrgUnit | null>(null);
  const [startDate, setStartDate] = useState(minDate);
  const [endDate, setEndDate] = useState(maxDate);
  const [source, setSource] = useState<ObjectiveProgressSource>("Direct");
  const [method, setMethod] = useState<MeasurementMethod>("NumericTarget");
  const [baseline, setBaseline] = useState("");
  const [target, setTarget] = useState("");
  const [unit, setUnit] = useState("");
  const [direction, setDirection] = useState<ImprovementDirection>("Increase");
  const [milestones, setMilestones] = useState<MilestoneRow[]>([{ title: "", weight: "" }]);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) return;
    const node = objective?.node;
    setTitle(node?.title ?? "");
    setDescription(objective?.description ?? "");
    setPerson(
      node
        ? { id: node.accountablePersonId, name: node.accountablePersonName ?? "Accountable person" }
        : defaultAccountable ?? null
    );
    setOrgUnit(
      node?.orgUnitId ? { id: node.orgUnitId, name: node.orgUnitName ?? "Selected unit", path: [] } : null
    );
    setStartDate(node?.startDate ?? minDate);
    setEndDate(node?.endDate ?? maxDate);
    setSource(node?.progressSource ?? "Direct");
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
  }, [open, objective, minDate, maxDate, defaultAccountable]);

  const base = parseNumeric(baseline);
  const tgt = parseNumeric(target);
  const numericInvalid = base.invalid || tgt.invalid;
  const sameValue = base.num !== null && tgt.num !== null && base.num === tgt.num;
  const weightSum = milestones.reduce((total, row) => total + (Number(row.weight) || 0), 0);

  const directValid =
    source !== "Direct" ||
    method !== "NumericTarget" ||
    (base.num !== null && tgt.num !== null && unit.trim() !== "" && !sameValue);
  const milestonesValid =
    source !== "Direct" ||
    method !== "WeightedMilestones" ||
    (milestones.every((row) => row.title.trim() !== "" && Number(row.weight) > 0) && weightSum === 100);
  const orgValid = isEdit || orgUnit !== null;
  const valid =
    title.trim() !== "" && person !== null && orgValid && endDate > startDate && directValid && milestonesValid;

  const preview = useMemo(() => {
    if (source === "Calculated") return "Calculated from contributors";
    if (method === "NumericTarget") {
      const arrow = direction === "Decrease" ? "↓" : "→";
      return `${baseline || "?"} ${arrow} ${target || "?"} ${unit}`.trim();
    }
    if (method === "WeightedMilestones") {
      const named = milestones.filter((row) => row.title.trim() !== "").length;
      return `${named} milestone${named === 1 ? "" : "s"} · ${weightSum}%`;
    }
    return "Manual completion %";
  }, [source, method, baseline, target, unit, direction, milestones, weightSum]);

  function buildMeasurement(): MeasurementInput | null {
    if (source === "Calculated") return null;
    if (method === "NumericTarget")
      return { method, baseline: base.num ?? 0, target: tgt.num ?? 0, unit: unit.trim(), direction };
    if (method === "WeightedMilestones")
      return { method, milestones: milestones.map((row) => ({ title: row.title.trim(), weight: Number(row.weight) })) };
    return { method: "ManualPercentage" };
  }

  async function handleSubmit() {
    setSubmitting(true);
    try {
      if (isEdit) {
        await onUpdate({
          title: title.trim(),
          description: description.trim() || null,
          accountablePersonId: person!.id,
          startDate,
          endDate,
          progressSource: source,
          measurement: buildMeasurement(),
        });
      } else {
        await onCreate({
          orgUnitId: orgUnit!.id,
          orgUnitName: orgUnit!.name,
          title: title.trim(),
          description: description.trim() || null,
          accountablePersonId: person!.id,
          parentObjectiveId: parent.id,
          startDate,
          endDate,
          progressSource: source,
          measurement: buildMeasurement(),
        });
      }
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
          <DialogTitle>{isEdit ? "Edit objective" : "New organizational objective"}</DialogTitle>
          <DialogDescription className="sr-only">
            Define an objective that supports {parent.title}.
          </DialogDescription>
        </DialogHeader>

        {/* Upstream relationship — stays visible while authoring. */}
        <div className="flex items-start gap-2.5 rounded-xl border border-border bg-muted/30 p-3">
          <ArrowUpRight className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
          <div className="min-w-0">
            <p className="type-eyebrow text-muted-foreground">Supports</p>
            <p className="truncate text-sm font-medium text-foreground">{parent.title}</p>
            <p className="truncate text-xs text-muted-foreground">{scopeLabel(parent)}</p>
          </div>
        </div>

        <div className="grid gap-x-8 gap-y-5 py-1 md:grid-cols-[1.05fr_1fr]">
          {/* Definition */}
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="og-title">Objective</Label>
              <Input
                id="og-title"
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                placeholder="Improve first-contact resolution"
                autoFocus
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="og-desc">
                Rationale <span className="font-normal text-muted-foreground">(optional)</span>
              </Label>
              <Textarea
                id="og-desc"
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                rows={2}
                placeholder="The contribution this objective makes to the direction above."
              />
            </div>

            {!isEdit ? (
              <div className="space-y-1.5">
                <Label>Owned by</Label>
                <OrgUnitPicker value={orgUnit} onChange={setOrgUnit} />
              </div>
            ) : null}

            <div className="space-y-1.5">
              <Label>Accountable person</Label>
              <EmployeePicker value={person} onChange={setPerson} />
            </div>

            <div className="space-y-1.5">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="og-start">From</Label>
                  <Input
                    id="og-start"
                    type="date"
                    value={startDate}
                    min={minDate}
                    max={maxDate}
                    onChange={(event) => setStartDate(event.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="og-end">To</Label>
                  <Input
                    id="og-end"
                    type="date"
                    value={endDate}
                    min={minDate}
                    max={maxDate}
                    onChange={(event) => setEndDate(event.target.value)}
                  />
                </div>
              </div>
              <p className="text-xs text-muted-foreground">Within the parent period.</p>
            </div>
          </div>

          {/* Progress source + measurement */}
          <div className="space-y-4 md:border-l md:border-border/60 md:pl-8">
            <div className="space-y-2">
              <Label>How progress is determined</Label>
              <div className="grid grid-cols-2 gap-2">
                <SourceOption
                  active={source === "Direct"}
                  icon={Gauge}
                  title="Direct"
                  detail="Measured on this objective"
                  onClick={() => setSource("Direct")}
                />
                <SourceOption
                  active={source === "Calculated"}
                  icon={Calculator}
                  title="Calculated"
                  detail="Rolls up from contributors"
                  onClick={() => setSource("Calculated")}
                />
              </div>
            </div>

            {source === "Direct" ? (
              <div className="space-y-3">
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

                {method === "NumericTarget" ? (
                  <div className="space-y-3">
                    <div className="grid grid-cols-[1fr_auto_1fr] items-end gap-2.5">
                      <div className="space-y-1.5">
                        <Label htmlFor="og-base">Baseline</Label>
                        <Input
                          id="og-base"
                          inputMode="decimal"
                          value={baseline}
                          onChange={(event) => setBaseline(event.target.value)}
                          placeholder="20"
                          aria-invalid={base.invalid}
                        />
                      </div>
                      <ArrowRight className="mb-2.5 size-4 text-muted-foreground" aria-hidden />
                      <div className="space-y-1.5">
                        <Label htmlFor="og-target">Target</Label>
                        <Input
                          id="og-target"
                          inputMode="decimal"
                          value={target}
                          onChange={(event) => setTarget(event.target.value)}
                          placeholder="80"
                          aria-invalid={tgt.invalid}
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1.5">
                        <Label htmlFor="og-unit">Unit</Label>
                        <Input
                          id="og-unit"
                          value={unit}
                          onChange={(event) => setUnit(event.target.value)}
                          placeholder="%, days, NPS…"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label>Direction</Label>
                        <Select
                          value={direction}
                          onValueChange={(next) => setDirection(next as ImprovementDirection)}
                        >
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
                        {weightSum === 100 ? " · balanced" : weightSum > 100 ? " · over" : ` · ${100 - weightSum} left`}
                      </span>
                    </div>
                  </div>
                ) : null}

                {method === "ManualPercentage" ? (
                  <p className="text-sm text-muted-foreground">
                    A single completion percentage the accountable person updates.
                  </p>
                ) : null}
              </div>
            ) : (
              <p className="rounded-xl border border-border/70 bg-muted/30 px-3.5 py-2.5 text-sm text-muted-foreground">
                Progress rolls up from the contributing children you configure once they exist and are
                published.
              </p>
            )}

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
          <AsyncButton pending={submitting} disabled={!valid} onClick={handleSubmit}>
            {isEdit ? "Save objective" : "Create objective"}
          </AsyncButton>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function SourceOption({
  active,
  icon: Icon,
  title,
  detail,
  onClick,
}: {
  active: boolean;
  icon: typeof Gauge;
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
