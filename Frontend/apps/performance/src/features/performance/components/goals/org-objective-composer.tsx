"use client";

import { useState } from "react";
import { ArrowUpRight, Building2, Gauge, Info, Sigma, UserRound } from "lucide-react";
import { toast } from "sonner";
import type {
  CreateOrganizationalObjectiveRequest,
  CycleSummaryDto,
  GoalDetailDto,
  GoalNodeDto,
  ImprovementDirection,
  MeasurementInput,
  MeasurementMethod,
  ObjectiveProgressSource,
  UpdateOrganizationalObjectiveRequest,
} from "@repo/api";
import { Avatar, AvatarFallback } from "@repo/ds/components/ui/avatar";
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
import { StatusBadge } from "@repo/ds/shell";
import { cn } from "@repo/ds/lib/utils";
import {
  EmployeePicker,
  OrgUnitPicker,
  type PickedEmployee,
  type PickedOrgUnit,
} from "@repo/workforce-ui";
import { parseNumeric } from "../../lib";
import {
  MeasurementEditor,
} from "../measurement/measurement-editor";
import {
  milestonesFromMeasurement,
  type MilestoneRow,
} from "../measurement/milestone-editor";
import { initials, scopeLabel } from "./goals-lib";

/**
 * The Create / Edit Organizational Objective composer — a surface-agnostic modal (modelled on the
 * employee Plan composer) that overlays whatever surface opened it: the Organization Goals workspace
 * today, a team-performance "create team objective" trigger later. It knows nothing about who opened
 * it — inputs arrive as props, and it reports out through `onCreate` / `onUpdate` / `onPublish`, so the
 * caller owns mutations, query invalidation, and where to return focus.
 *
 * Its grammar: fixed parent direction (header) → objective definition → scope & accountability →
 * "how is progress measured?" (Direct vs Calculated, then the shared measurement editor). Draft is a
 * resumable state; the happy path ends in Publish once requirements are met.
 */
export function OrgObjectiveComposer({
  open,
  onOpenChange,
  parent,
  objective,
  defaultAccountable,
  defaultOrgUnit,
  onCreate,
  onUpdate,
  onPublish,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  cycle: CycleSummaryDto;
  parent: GoalNodeDto;
  objective?: GoalDetailDto;
  /** Convenience default for a new objective's accountable person (the signed-in user); editable. */
  defaultAccountable?: PickedEmployee | null;
  /** Preselected organizational scope when launched from a scoped context (the actor's own unit); editable. */
  defaultOrgUnit?: PickedOrgUnit | null;
  /** Persists a new draft and returns it (the caller reads `node.id`). */
  onCreate: (request: CreateOrganizationalObjectiveRequest) => Promise<GoalDetailDto>;
  /** Persists edits to an existing draft. */
  onUpdate: (objectiveId: string, request: UpdateOrganizationalObjectiveRequest) => Promise<void>;
  /** Publishes a persisted draft as organizational direction. */
  onPublish: (objectiveId: string) => Promise<void>;
}) {
  const isEdit = Boolean(objective);
  // Child dates are bounded by the parent objective (which is itself bounded by the Cycle),
  // so the parent's window is the authoritative min/max the server enforces.
  const minDate = parent.startDate;
  const maxDate = parent.endDate;

  const node = objective?.node;
  const [title, setTitle] = useState(node?.title ?? "");
  const [description, setDescription] = useState(objective?.description ?? "");
  const [person, setPerson] = useState<PickedEmployee | null>(
    node
      ? {
          id: node.accountablePersonId,
          name: node.accountablePersonName ?? "Accountable person",
        }
      : (defaultAccountable ?? null)
  );
  const [orgUnit, setOrgUnit] = useState<PickedOrgUnit | null>(
    node?.orgUnitId
      ? {
          id: node.orgUnitId,
          name: node.orgUnitName ?? "Selected unit",
          path: [],
        }
      : (defaultOrgUnit ?? null)
  );
  const [startDate, setStartDate] = useState(node?.startDate ?? minDate);
  const [endDate, setEndDate] = useState(node?.endDate ?? maxDate);
  const [source, setSource] = useState<ObjectiveProgressSource>(
    node?.progressSource ?? "Direct"
  );
  const measurement = objective?.measurement;
  const [method, setMethod] = useState<MeasurementMethod>(
    measurement?.method ?? "NumericTarget"
  );
  const [baseline, setBaseline] = useState(
    measurement?.baseline != null ? String(measurement.baseline) : ""
  );
  const [target, setTarget] = useState(
    measurement?.target != null ? String(measurement.target) : ""
  );
  const [unit, setUnit] = useState(measurement?.unit ?? "");
  const [direction, setDirection] = useState<ImprovementDirection>(
    measurement?.direction ?? "Increase"
  );
  const [milestones, setMilestones] = useState<MilestoneRow[]>(() =>
    milestonesFromMeasurement(measurement)
  );
  const [busy, setBusy] = useState<null | "draft" | "publish">(null);
  // Once a new draft has been created (or on edit), the objective exists on the server: its org unit
  // and parent are fixed, and any further action updates rather than re-creates it.
  const [committedId, setCommittedId] = useState<string | null>(null);
  const persistedId = objective?.node.id ?? committedId;
  const isPersisted = persistedId !== null;
  const scopeLocked = isEdit || committedId !== null;

  const base = parseNumeric(baseline);
  const tgt = parseNumeric(target);
  const numericInvalid = base.invalid || tgt.invalid;
  const sameValue =
    base.num !== null && tgt.num !== null && base.num === tgt.num;
  const weightSum = milestones.reduce(
    (total, row) => total + (Number(row.weight) || 0),
    0
  );
  const namedMilestones = milestones.filter((row) => row.title.trim() !== "");

  // ── Readiness ──────────────────────────────────────────────────────────────
  // A Draft can be saved once it is structurally valid — the same minimums the domain enforces
  // when it constructs the objective (title, scope, accountable, dates, and a well-formed
  // measurement). Publish adds exactly one gate: weighted-milestone weights must total 100%.
  const missing: string[] = [];
  if (title.trim() === "") missing.push("a title");
  if (!scopeLocked && orgUnit === null) missing.push("an organizational scope");
  if (person === null) missing.push("an accountable person");
  if (!(endDate > startDate)) missing.push("valid dates");
  if (source === "Direct" && method === "NumericTarget") {
    if (base.num === null || tgt.num === null || numericInvalid)
      missing.push("a baseline and target");
    else if (sameValue) missing.push("a target that differs from the baseline");
    if (unit.trim() === "") missing.push("a unit");
  }
  if (source === "Direct" && method === "WeightedMilestones") {
    const everyRowValid = milestones.every(
      (row) =>
        row.title.trim() !== "" &&
        Number(row.weight) > 0 &&
        Number(row.weight) <= 100
    );
    if (namedMilestones.length === 0 || !everyRowValid)
      missing.push("named milestones with weights");
  }
  const canSaveDraft = missing.length === 0;

  const weightedIncomplete =
    source === "Direct" && method === "WeightedMilestones" && weightSum !== 100;
  const publishBlocker = !canSaveDraft
    ? null // draft-level requirements are surfaced first
    : weightedIncomplete
      ? weightSum < 100
        ? `Milestone weights total ${weightSum}% — assign ${100 - weightSum}% more to publish.`
        : `Milestone weights total ${weightSum}% — remove ${weightSum - 100}% to publish.`
      : null;
  const canPublish = canSaveDraft && publishBlocker === null;

  function buildMeasurement(): MeasurementInput | null {
    if (source === "Calculated") return null;
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
        milestones: namedMilestones.map((row) => ({
          title: row.title.trim(),
          weight: Number(row.weight),
        })),
      };
    return { method: "ManualPercentage" };
  }

  function createRequest(): CreateOrganizationalObjectiveRequest {
    return {
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
    };
  }

  function updateRequest(): UpdateOrganizationalObjectiveRequest {
    return {
      title: title.trim(),
      description: description.trim() || null,
      accountablePersonId: person!.id,
      startDate,
      endDate,
      progressSource: source,
      measurement: buildMeasurement(),
    };
  }

  /** Persist the current form as a draft, creating on first save and updating thereafter. */
  async function persist(): Promise<string> {
    if (isPersisted) {
      await onUpdate(persistedId!, updateRequest());
      return persistedId!;
    }
    const created = await onCreate(createRequest());
    setCommittedId(created.node.id);
    return created.node.id;
  }

  async function handleSaveDraft() {
    setBusy("draft");
    try {
      await persist();
      toast.success("Draft saved.");
      onOpenChange(false);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Could not save the draft."
      );
      setBusy(null);
    }
  }

  async function handlePublish() {
    setBusy("publish");
    let objectiveId: string;
    try {
      objectiveId = await persist();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Could not save the objective."
      );
      setBusy(null);
      return;
    }
    try {
      await onPublish(objectiveId);
    } catch (publishError) {
      // The draft is safely persisted; publishing is what failed. Keep the modal open on that draft
      // (now in edit mode, org unit fixed) so the author can retry rather than losing the work.
      toast.error(
        publishError instanceof Error
          ? publishError.message
          : "The draft was saved but could not be published."
      );
      setBusy(null);
      return;
    }
    toast.success("Published as organizational direction.");
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[92vh] w-full flex-col gap-0 overflow-hidden p-0 sm:max-w-4xl">
        {/* Header — identity only; the fixed parent context leads the scrolling body. */}
        <div className="border-b border-border px-6 py-5 pr-14">
          <DialogTitle>
            {isEdit ? "Edit objective" : "Create organizational objective"}
          </DialogTitle>
        </div>

        {/* Body — scrolls; header and footer stay put. */}
        <div className="flex-1 overflow-y-auto px-6 py-6">
          <div className="space-y-8">
            <ParentDirectionBand parent={parent} />

            {/* 1. Objective definition */}
            <Section n={1} title="Objective definition">
              <div className="space-y-1.5">
                <Label htmlFor="og-title">
                  Title <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="og-title"
                  value={title}
                  onChange={(event) => setTitle(event.target.value)}
                  placeholder="Improve talent development execution"
                  autoFocus
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="og-desc">
                  Description{" "}
                  <span className="font-normal text-muted-foreground">
                    (optional)
                  </span>
                </Label>
                <Textarea
                  id="og-desc"
                  value={description}
                  onChange={(event) => setDescription(event.target.value)}
                  rows={2}
                  placeholder="The contribution this objective makes to the direction above."
                />
              </div>
            </Section>

            {/* 2. Scope & accountability — two distinct concepts, shown side by side, plus the window. */}
            <Section n={2} title="Scope & accountability">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label className="flex items-center gap-1.5">
                    <Building2
                      className="size-3.5 text-muted-foreground"
                      aria-hidden
                    />
                    Organizational scope{" "}
                    <span className="text-destructive">*</span>
                  </Label>
                  {scopeLocked ? (
                    <div className="flex h-8 items-center gap-2 rounded-xl border border-border bg-muted/40 px-2.5 text-sm">
                      <span className="truncate font-medium">
                        {orgUnit?.name ?? node?.orgUnitName ?? "Owning unit"}
                      </span>
                    </div>
                  ) : (
                    <OrgUnitPicker value={orgUnit} onChange={setOrgUnit} />
                  )}
                </div>
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
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="og-start">Start</Label>
                  <DatePicker
                    id="og-start"
                    value={startDate}
                    min={minDate}
                    max={endDate || maxDate}
                    onChange={setStartDate}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="og-end">End</Label>
                  <DatePicker
                    id="og-end"
                    value={endDate}
                    min={startDate || minDate}
                    max={maxDate}
                    onChange={setEndDate}
                  />
                </div>
              </div>
            </Section>

            {/* 3. Measurement — the progress source, then the shared measurement editor when Direct. */}
            <Section
              n={3}
              title="Measurement"
              hint="How will progress on this objective be measured?"
            >
              <div className="grid gap-3 sm:grid-cols-2">
                <SourceCard
                  active={source === "Direct"}
                  icon={Gauge}
                  title="Measure directly"
                  detail="Track this objective with its own business measure."
                  onClick={() => setSource("Direct")}
                />
                <SourceCard
                  active={source === "Calculated"}
                  icon={Sigma}
                  title="Calculate from contributors"
                  detail="Roll up from published direct child objectives."
                  onClick={() => setSource("Calculated")}
                />
              </div>

              {source === "Direct" ? (
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
                  milestoneReadyLabel="Ready to publish"
                />
              ) : (
                <div className="flex items-center gap-2.5 rounded-xl border border-info/25 bg-info-subtle px-4 py-3 text-sm text-info">
                  <Info className="size-4 shrink-0" aria-hidden />
                  Progress rolls up from the objectives aligned beneath this one.
                </div>
              )}
            </Section>
          </div>
        </div>

        {/* Footer — stable. Cancel is quiet; Draft is resumable; Publish is the happy-path outcome. */}
        <div className="flex items-center justify-between gap-2 border-t border-border bg-muted/30 px-6 py-4">
          <Button
            variant="ghost"
            onClick={() => onOpenChange(false)}
            disabled={busy !== null}
          >
            Cancel
          </Button>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              onClick={handleSaveDraft}
              disabled={!canSaveDraft || busy !== null}
            >
              {busy === "draft" ? "Saving…" : "Save as draft"}
            </Button>
            <Button
              onClick={handlePublish}
              disabled={!canPublish || busy !== null}
              title={publishBlocker ?? undefined}
            >
              {busy === "publish" ? "Publishing…" : "Publish objective"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ── Parent direction ───────────────────────────────────────────────────────────

function ParentDirectionBand({ parent }: { parent: GoalNodeDto }) {
  const summary = parent.measurementSummary?.trim();
  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="type-eyebrow inline-flex items-center gap-1.5 text-primary">
            <ArrowUpRight className="size-3.5" aria-hidden /> Parent objective
          </p>
          <p className="mt-1.5 truncate text-lg font-semibold tracking-tight text-foreground">
            {parent.title}
          </p>
        </div>
        <StatusBadge tone="success" dot>
          Published
        </StatusBadge>
      </div>
      <div className="mt-3 flex w-full flex-wrap items-center gap-x-4 gap-y-2 text-sm text-muted-foreground">
        <span className="inline-flex items-center gap-2">
          <Building2 className="size-4 text-muted-foreground/80" aria-hidden />{" "}
          <span className="font-medium text-foreground">{scopeLabel(parent)}</span>
        </span>
        {parent.accountablePersonName ? (
          <span className="inline-flex items-center gap-2">
            <Avatar className="size-6">
              <AvatarFallback className="text-[0.625rem]">
                {initials(parent.accountablePersonName)}
              </AvatarFallback>
            </Avatar>
            <span className="font-medium text-foreground">
              {parent.accountablePersonName}
            </span>
          </span>
        ) : null}
        {summary ? (
          <span className="ml-auto font-semibold tabular-nums text-primary">
            {summary}
          </span>
        ) : null}
      </div>
    </div>
  );
}

// ── Numbered section (shared visual grammar with the plan composer) ──────────────

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
      <div className="space-y-4">{children}</div>
    </section>
  );
}

// ── Progress-source card (Direct vs Calculated) ──────────────────────────────────

function SourceCard({
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
      aria-pressed={active}
      className={cn(
        "group flex items-start gap-3 rounded-xl border p-3.5 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
        active
          ? "border-primary bg-primary/[0.06] ring-1 ring-primary/40"
          : "border-border hover:border-primary/40 hover:bg-muted/40"
      )}
    >
      <span
        className={cn(
          "flex size-10 shrink-0 items-center justify-center rounded-xl transition-colors",
          active
            ? "bg-primary/15 text-primary"
            : "bg-muted text-muted-foreground group-hover:text-foreground"
        )}
      >
        <Icon className="size-5" aria-hidden />
      </span>
      <span className="min-w-0">
        <span className="block text-sm font-medium text-foreground">
          {title}
        </span>
        <span className="mt-0.5 block text-xs leading-snug text-muted-foreground">
          {detail}
        </span>
      </span>
    </button>
  );
}
