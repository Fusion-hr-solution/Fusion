"use client";

import { useEffect, useMemo, useState } from "react";
import { ArrowUpRight, Building2, Calculator, Gauge, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import type {
  CreateOrganizationalObjectiveRequest,
  GoalDetailDto,
  GoalNodeDto,
  ImprovementDirection,
  MeasurementInput,
  MeasurementMethod,
  ObjectiveProgressSource,
  OrganizationHierarchyNodeDto,
  UpdateOrganizationalObjectiveRequest,
} from "@repo/api";
import { Button } from "@repo/ds/components/ui/button";
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
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@repo/ds/components/ui/sheet";
import { AsyncButton } from "@repo/ds/shell";
import { cn } from "@repo/ds/lib/utils";
import { MEASUREMENT_LABELS } from "../../lib";
import { EmployeePicker, type PickedEmployee } from "../employee-picker";
import { useOrgHierarchy } from "../../api/use-performance";
import { scopeLabel } from "./goals-lib";

interface MilestoneRow {
  title: string;
  weight: string;
}

interface FlatUnit {
  id: string;
  name: string;
  depth: number;
}

function flatten(nodes: OrganizationHierarchyNodeDto[], depth = 0, acc: FlatUnit[] = []): FlatUnit[] {
  for (const node of nodes) {
    acc.push({ id: node.unit.id, name: node.unit.name, depth });
    flatten(node.children, depth + 1, acc);
  }
  return acc;
}

export function OrgObjectiveComposer({
  open,
  onOpenChange,
  parent,
  objective,
  onCreate,
  onUpdate,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  parent: GoalNodeDto;
  objective?: GoalDetailDto;
  onCreate: (request: CreateOrganizationalObjectiveRequest) => Promise<void>;
  onUpdate: (request: UpdateOrganizationalObjectiveRequest) => Promise<void>;
}) {
  const isEdit = Boolean(objective);
  const hierarchy = useOrgHierarchy(open && !isEdit);
  const units = useMemo(() => (hierarchy.data ? flatten(hierarchy.data.roots) : []), [hierarchy.data]);

  const minDate = parent.startDate;
  const maxDate = parent.endDate;

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [person, setPerson] = useState<PickedEmployee | null>(null);
  const [orgUnitId, setOrgUnitId] = useState("");
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
    setPerson(node ? { id: node.accountablePersonId, name: node.accountablePersonName ?? "Accountable person" } : null);
    setOrgUnitId(node?.orgUnitId ?? "");
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
  }, [open, objective, minDate, maxDate]);

  const weightSum = milestones.reduce((total, row) => total + (Number(row.weight) || 0), 0);
  const directValid =
    source !== "Direct" ||
    method !== "NumericTarget" ||
    (baseline !== "" && target !== "" && unit.trim() !== "" && Number(baseline) !== Number(target));
  const milestonesValid =
    source !== "Direct" ||
    method !== "WeightedMilestones" ||
    (milestones.every((row) => row.title.trim() !== "" && Number(row.weight) > 0) && weightSum === 100);
  const orgValid = isEdit || orgUnitId !== "";
  const valid =
    title.trim() !== "" && person !== null && orgValid && endDate > startDate && directValid && milestonesValid;

  function buildMeasurement(): MeasurementInput | null {
    if (source === "Calculated") return null;
    if (method === "NumericTarget") return { method, baseline: Number(baseline), target: Number(target), unit: unit.trim(), direction };
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
        const selected = units.find((item) => item.id === orgUnitId);
        await onCreate({
          orgUnitId,
          orgUnitName: selected?.name ?? null,
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
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="flex w-full flex-col gap-0 overflow-y-auto p-0 sm:max-w-xl">
        <SheetHeader className="border-b p-6">
          <SheetTitle>{isEdit ? "Edit objective" : "New organizational objective"}</SheetTitle>
          <SheetDescription className="sr-only">Define an objective that supports {parent.title}.</SheetDescription>
          {/* Upstream context — the relationship being created stays visible. */}
          <div className="mt-2 flex items-start gap-2 rounded-xl border bg-muted/30 p-3 text-sm">
            <ArrowUpRight className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
            <div className="min-w-0">
              <p className="text-xs uppercase tracking-[0.12em] text-muted-foreground">Supports</p>
              <p className="truncate font-medium">{parent.title}</p>
              <p className="truncate text-xs text-muted-foreground">{scopeLabel(parent)}</p>
            </div>
          </div>
        </SheetHeader>

        <div className="flex-1 space-y-5 p-6">
          <div className="space-y-1.5">
            <Label htmlFor="og-title">Objective</Label>
            <Input id="og-title" value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Improve first-contact resolution" autoFocus />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="og-desc">Why it matters <span className="text-muted-foreground">(optional)</span></Label>
            <Textarea id="og-desc" value={description} onChange={(event) => setDescription(event.target.value)} rows={2} placeholder="The contribution this objective makes to the direction above." />
          </div>

          {!isEdit ? (
            <div className="space-y-1.5">
              <Label>Owned by</Label>
              <Select value={orgUnitId} onValueChange={setOrgUnitId} disabled={hierarchy.isLoading}>
                <SelectTrigger>
                  <SelectValue placeholder={hierarchy.isLoading ? "Loading organization…" : "Select an organizational unit"} />
                </SelectTrigger>
                <SelectContent>
                  {units.map((item) => (
                    <SelectItem key={item.id} value={item.id}>
                      <span className="inline-flex items-center gap-1.5">
                        <Building2 className="size-3.5 text-muted-foreground" aria-hidden />
                        <span style={{ paddingLeft: `${item.depth * 10}px` }}>{item.name}</span>
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : null}

          <div className="space-y-1.5">
            <Label>Accountable person</Label>
            <EmployeePicker value={person} onChange={setPerson} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="og-start">From</Label>
              <Input id="og-start" type="date" value={startDate} min={minDate} max={maxDate} onChange={(event) => setStartDate(event.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="og-end">To</Label>
              <Input id="og-end" type="date" value={endDate} min={minDate} max={maxDate} onChange={(event) => setEndDate(event.target.value)} />
            </div>
          </div>
          <p className="text-xs text-muted-foreground">Within the parent period: {minDate} to {maxDate}.</p>

          {/* Progress source — direct or calculated, never both. */}
          <div className="space-y-3 rounded-xl border p-4">
            <Label>How progress is determined</Label>
            <div className="grid grid-cols-2 gap-2">
              <SourceOption
                active={source === "Direct"}
                icon={Gauge}
                title="Direct measurement"
                detail="A target this objective tracks itself"
                onClick={() => setSource("Direct")}
              />
              <SourceOption
                active={source === "Calculated"}
                icon={Calculator}
                title="Calculated"
                detail="Rolls up from contributing children"
                onClick={() => setSource("Calculated")}
              />
            </div>

            {source === "Direct" ? (
              <div className="space-y-3 pt-1">
                <Select value={method} onValueChange={(next) => setMethod(next as MeasurementMethod)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {(Object.keys(MEASUREMENT_LABELS) as MeasurementMethod[]).map((key) => (
                      <SelectItem key={key} value={key}>{MEASUREMENT_LABELS[key]}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                {method === "NumericTarget" ? (
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label htmlFor="og-base">Baseline</Label>
                      <Input id="og-base" type="number" value={baseline} onChange={(event) => setBaseline(event.target.value)} />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="og-target">Target</Label>
                      <Input id="og-target" type="number" value={target} onChange={(event) => setTarget(event.target.value)} />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="og-unit">Unit</Label>
                      <Input id="og-unit" value={unit} onChange={(event) => setUnit(event.target.value)} placeholder="%, days, NPS…" />
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
                          onChange={(event) => setMilestones((rows) => rows.map((item, i) => (i === index ? { ...item, title: event.target.value } : item)))}
                          placeholder={`Milestone ${index + 1}`}
                          className="flex-1"
                        />
                        <Input
                          type="number"
                          value={row.weight}
                          onChange={(event) => setMilestones((rows) => rows.map((item, i) => (i === index ? { ...item, weight: event.target.value } : item)))}
                          placeholder="%"
                          className="w-20"
                        />
                        <Button variant="ghost" size="icon-sm" onClick={() => setMilestones((rows) => (rows.length > 1 ? rows.filter((_, i) => i !== index) : rows))} aria-label="Remove milestone">
                          <Trash2 className="size-3.5" />
                        </Button>
                      </div>
                    ))}
                    <div className="flex items-center justify-between">
                      <Button variant="ghost" size="sm" onClick={() => setMilestones((rows) => [...rows, { title: "", weight: "" }])}>
                        <Plus className="size-3.5" data-icon="inline-start" /> Add milestone
                      </Button>
                      <span className={cn("text-sm font-medium tabular-nums", weightSum === 100 ? "text-success" : "text-warning")}>{weightSum}% / 100%</span>
                    </div>
                  </div>
                ) : null}

                {method === "ManualPercentage" ? (
                  <p className="text-sm text-muted-foreground">A single completion percentage the accountable person updates.</p>
                ) : null}
              </div>
            ) : (
              <p className="rounded-lg bg-muted/30 px-3 py-2 text-sm text-muted-foreground">
                Progress rolls up from the contributing children you configure once they exist and are approved.
              </p>
            )}
          </div>
        </div>

        <div className="sticky bottom-0 flex justify-end gap-2 border-t bg-background p-4">
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={submitting}>Cancel</Button>
          <AsyncButton pending={submitting} disabled={!valid} onClick={handleSubmit}>
            {isEdit ? "Save objective" : "Create objective"}
          </AsyncButton>
        </div>
      </SheetContent>
    </Sheet>
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
