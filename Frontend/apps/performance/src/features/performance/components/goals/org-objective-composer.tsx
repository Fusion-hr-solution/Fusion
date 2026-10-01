"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Building2, Gauge, Info, Sigma, Target, UserRound, Waypoints } from "@/lib/icons";
import { toast } from "sonner";
import type {
  CreateOrganizationalObjectiveRequest,
  CycleSummaryDto,
  GoalDetailDto,
  AlignmentTargetDto,
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
import {
  EntityPicker,
  type EntityOption,
} from "@repo/ds/components/ui/entity-picker";
import {
  Combobox,
  ComboboxContent,
  ComboboxGroup,
  ComboboxItem,
  ComboboxLabel,
  ComboboxList,
  ComboboxTrigger,
} from "@repo/ds/components/ui/combobox";
import { RadioGroup, RadioGroupItem } from "@repo/ds/components/ui/radio-group";
import { cn } from "@repo/ds/lib/utils";
import {
  OrgUnitPicker,
  type PickedEmployee,
  type PickedOrgUnit,
} from "@repo/workforce-ui";
import { useTeamObjectiveWorkspace } from "../../api/use-performance";
import { formatDate, parseNumeric } from "../../lib";
import { MeasurementEditor } from "../measurement/measurement-editor";
import {
  milestonesFromMeasurement,
  type MilestoneRow,
} from "../measurement/milestone-editor";
import { initials } from "./goals-lib";
import { ObjectiveComposerSection } from "../objective-composer-section";
import type { ComposerAlignmentContext } from "./org-composer-host";

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
  cycle,
  initialAlignment,
  objective,
  defaultAccountable,
  defaultOrgUnit,
  teamLocked,
  onCreate,
  onUpdate,
  onPublish,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  cycle: CycleSummaryDto;
  initialAlignment: ComposerAlignmentContext;
  objective?: GoalDetailDto;
  /** Convenience default for a new objective's accountable person (the signed-in user); editable. */
  defaultAccountable?: PickedEmployee | null;
  /** Preselected organizational scope when launched from a scoped context (the actor's own unit); editable. */
  defaultOrgUnit?: PickedOrgUnit | null;
  teamLocked: boolean;
  /** Persists a new draft and returns it (the caller reads `node.id`). */
  onCreate: (
    request: CreateOrganizationalObjectiveRequest
  ) => Promise<GoalDetailDto>;
  /** Persists edits to an existing draft. */
  onUpdate: (
    objectiveId: string,
    request: UpdateOrganizationalObjectiveRequest
  ) => Promise<void>;
  /** Publishes a persisted draft as organizational direction. */
  onPublish: (objectiveId: string) => Promise<void>;
}) {
  const isEdit = Boolean(objective);
  const node = objective?.node;
  const [alignmentMode, setAlignmentMode] = useState<
    "aligned" | "standalone" | null
  >(initialAlignment?.mode ?? null);
  const [parentId, setParentId] = useState(
    initialAlignment?.mode === "aligned" ? initialAlignment.parentId : ""
  );
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
  const workspace = useTeamObjectiveWorkspace(
    cycle.id,
    orgUnit?.id ?? null,
    open && orgUnit !== null
  );
  const targets = useMemo(
    () => workspace.data?.alignmentTargets ?? [],
    [workspace.data]
  );
  const owners = useMemo(
    () => workspace.data?.eligibleOwners ?? [],
    [workspace.data]
  );
  const selectedTarget =
    targets.find((target) => target.id === parentId) ?? null;
  const minDate =
    alignmentMode === "aligned" && selectedTarget
      ? selectedTarget.startDate
      : cycle.startDate;
  const maxDate =
    alignmentMode === "aligned" && selectedTarget
      ? selectedTarget.endDate
      : cycle.endDate;
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
  const alignmentRef = useRef<HTMLDivElement>(null);
  // Once a new draft has been created (or on edit), the objective exists on the server: its org unit
  // and parent are fixed, and any further action updates rather than re-creates it.
  const [committedId, setCommittedId] = useState<string | null>(null);
  const persistedId = objective?.node.id ?? committedId;
  const isPersisted = persistedId !== null;
  const scopeLocked = teamLocked || isEdit || committedId !== null;


  useEffect(() => {
    if (!workspace.data) return;
    if (
      parentId &&
      !workspace.data.alignmentTargets.some((target) => target.id === parentId)
    ) {
      setParentId("");
    }
    if (
      person &&
      !workspace.data.eligibleOwners.some((owner) => owner.id === person.id)
    ) {
      setPerson(null);
      return;
    }
    if (!person && defaultAccountable) {
      const eligible = workspace.data.eligibleOwners.find(
        (owner) => owner.id === defaultAccountable.id
      );
      if (eligible)
        setPerson({
          id: eligible.id,
          name: eligible.name ?? defaultAccountable.name,
        });
    }
  }, [workspace.data, parentId, person, defaultAccountable]);

  useEffect(() => {
    if (startDate < minDate || startDate >= maxDate) setStartDate(minDate);
    if (endDate > maxDate || endDate <= minDate) setEndDate(maxDate);
  }, [minDate, maxDate, startDate, endDate]);

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
  if (alignmentMode === null) missing.push("an alignment choice");
  if (alignmentMode === "aligned" && !selectedTarget)
    missing.push("an upstream objective");
  if (workspace.isLoading) missing.push("team options to finish loading");
  if (workspace.error) missing.push("available team options");
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
      parentObjectiveId: alignmentMode === "aligned" ? parentId : null,
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
      parentObjectiveId: alignmentMode === "aligned" ? parentId : null,
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
    toast.success("Team objective published.");
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[92vh] w-full flex-col gap-0 overflow-hidden p-0 sm:max-w-4xl">
        {/* Header — identity only; the fixed parent context leads the scrolling body. */}
        <div className="border-b border-border px-6 py-5 pr-14">
          <DialogTitle>
            {isEdit ? "Edit team objective" : "Create team objective"}
          </DialogTitle>
        </div>

        {/* Body — scrolls; header and footer stay put. */}
        <div className="flex-1 overflow-y-auto px-6 py-6">
          <div className="space-y-8">
            {!teamLocked && !isPersisted ? (
              <section className="rounded-surface border border-border bg-card p-5">
                <Label className="flex items-center gap-1.5">
                  <Building2
                    className="size-3.5 text-muted-foreground"
                    aria-hidden
                  />
                  Owning team <span className="text-destructive">*</span>
                </Label>
                <div className="mt-2">
                  <OrgUnitPicker
                    value={orgUnit}
                    onChange={(unit) => {
                      setOrgUnit(unit);
                      setPerson(null);
                      setParentId("");
                      setAlignmentMode(null);
                    }}
                  />
                </div>
              </section>
            ) : null}
            <div ref={alignmentRef} className="scroll-mt-4">
              <AlignmentEditor
                mode={alignmentMode}
                onModeChange={(mode) => {
                  setAlignmentMode(mode);
                  if (mode === "standalone") setParentId("");
                }}
                parentId={parentId}
                onParentChange={setParentId}
                targets={targets}
                loading={workspace.isLoading}
                error={workspace.error}
                disabled={orgUnit === null || busy !== null}
              />
            </div>

            {/* 1. Objective definition */}
            <ObjectiveComposerSection
              n={1}
              title="Objective definition"
              bodyClassName="space-y-4"
            >
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
            </ObjectiveComposerSection>

            {/* 2. Scope & accountability — two distinct concepts, shown side by side, plus the window. */}
            <ObjectiveComposerSection
              n={2}
              title="Scope & accountability"
              bodyClassName="space-y-4"
            >
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
                  {orgUnit ? (
                    <div className="flex h-8 items-center gap-2 rounded-control border border-border dark:bg-input/30 px-2.5 text-sm">
                      <span className="truncate font-medium">
                        {orgUnit?.name ?? node?.orgUnitName ?? "Owning unit"}
                      </span>
                    </div>
                  ) : (
                    <div className="flex h-8 items-center rounded-control border border-dashed border-border px-2.5 text-sm text-muted-foreground">
                      Choose the owning team above
                    </div>
                  )}
                </div>
                <div className="space-y-1.5">
                  <Label className="flex items-center gap-1.5">
                    <UserRound
                      className="size-3.5 text-muted-foreground"
                      aria-hidden
                    />
                    Accountable person{" "}
                    <span className="text-destructive">*</span>
                  </Label>
                  <OwnerPicker
                    value={person}
                    onChange={setPerson}
                    owners={owners}
                    loading={workspace.isLoading}
                    disabled={
                      orgUnit === null ||
                      workspace.isLoading ||
                      owners.length === 0
                    }
                  />
                  {!workspace.isLoading && orgUnit && owners.length === 0 ? (
                    <p className="text-xs text-destructive">
                      This team has no eligible owners for the cycle.
                    </p>
                  ) : null}
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
            </ObjectiveComposerSection>

            {/* 3. Measurement — the progress source, then the shared measurement editor when Direct. */}
            <ObjectiveComposerSection
              n={3}
              title="Measurement"
              hint="How will progress on this objective be measured?"
              bodyClassName="space-y-4"
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
                <div className="flex items-center gap-2.5 rounded-surface border border-info/25 bg-info-subtle px-4 py-3 text-sm text-info">
                  <Info className="size-4 shrink-0" aria-hidden />
                  Progress rolls up from the objectives aligned beneath this
                  one.
                </div>
              )}
            </ObjectiveComposerSection>
          </div>
        </div>

        {/* Footer — stable. Cancel is quiet; Draft is resumable; Publish is the happy-path outcome. */}
        <div className="flex items-center justify-between gap-2 border-t border-border px-6 py-4">
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

// ── Alignment and owner selection ─────────────────────────────────────────────

function AlignmentEditor({
  mode,
  onModeChange,
  parentId,
  onParentChange,
  targets,
  loading,
  error,
  disabled,
}: {
  mode: "aligned" | "standalone" | null;
  onModeChange: (mode: "aligned" | "standalone") => void;
  parentId: string;
  onParentChange: (id: string) => void;
  targets: AlignmentTargetDto[];
  loading: boolean;
  error: Error | null;
  disabled: boolean;
}) {
  return (
    <section
      className="rounded-surface border border-border p-5"
      aria-labelledby="objective-alignment-heading"
    >
      <div>
        <h2
          id="objective-alignment-heading"
          className="type-section-title text-foreground"
        >
          Alignment
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Choose the organizational direction this objective supports.
        </p>
      </div>
      <RadioGroup
        className="mt-4 grid gap-3 sm:grid-cols-2"
        value={mode ?? ""}
        onValueChange={(value) =>
          onModeChange(value as "aligned" | "standalone")
        }
      >
        <label
          className={cn(
            "flex cursor-pointer items-start gap-3 rounded-surface border p-3.5 transition-colors",
            mode === "aligned"
              ? "border-primary bg-primary/[0.06]"
              : "border-border bg-card hover:border-primary/40",
            (disabled || targets.length === 0) &&
              "cursor-not-allowed opacity-60"
          )}
        >
          <RadioGroupItem
            value="aligned"
            disabled={disabled || targets.length === 0}
            className="mt-0.5"
          />
          <span>
            <span className="block text-sm font-medium text-foreground">
              Align to organizational direction
            </span>
            <span className="mt-0.5 block text-xs leading-snug text-muted-foreground">
              Connect this objective to a published upstream objective.
            </span>
          </span>
        </label>
        <label
          className={cn(
            "flex cursor-pointer items-start gap-3 rounded-surface border p-3.5 transition-colors",
            mode === "standalone"
              ? "border-primary bg-primary/[0.06]"
              : "border-border bg-card hover:border-primary/40",
            disabled && "cursor-not-allowed opacity-60"
          )}
        >
          <RadioGroupItem
            value="standalone"
            disabled={disabled}
            className="mt-0.5"
          />
          <span>
            <span className="block text-sm font-medium text-foreground">
              Standalone team objective
            </span>
            <span className="mt-0.5 block text-xs leading-snug text-muted-foreground">
              Keep this objective within Team Performance without an upstream
              link.
            </span>
          </span>
        </label>
      </RadioGroup>

      {mode === "aligned" ? (
        <div className="mt-4 space-y-1.5">
          <Label>Upstream objective</Label>
          <AlignmentTargetPicker
            targets={targets}
            value={parentId || null}
            onChange={onParentChange}
            disabled={disabled || loading}
          />
        </div>
      ) : null}

      {error ? (
        <p className="mt-3 text-sm text-destructive">
          Team options could not be loaded. Close and try again.
        </p>
      ) : !loading && targets.length === 0 ? (
        <p className="mt-3 text-sm text-muted-foreground">
          No published upstream objectives are available. You can still create a
          standalone objective.
        </p>
      ) : null}
    </section>
  );
}

export function AlignmentTargetPicker({
  targets,
  value,
  onChange,
  includeStandalone = false,
  onStandalone,
  disabled,
  open: openProp,
  onOpenChange,
}: {
  targets: AlignmentTargetDto[];
  value: string | null;
  onChange: (id: string) => void;
  includeStandalone?: boolean;
  onStandalone?: () => void;
  disabled?: boolean;
  /** Optional control so a surface can open the picker from elsewhere. */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}) {
  const [innerOpen, setInnerOpen] = useState(false);
  const open = openProp ?? innerOpen;
  const setOpen = (next: boolean) => {
    setInnerOpen(next);
    onOpenChange?.(next);
  };
  const triggerRef = useRef<HTMLButtonElement>(null);
  const [container, setContainer] = useState<HTMLElement | null>(null);
  useEffect(() => {
    if (open)
      setContainer(
        triggerRef.current?.closest<HTMLElement>(
          "[data-slot='dialog-content']"
        ) ?? null
      );
  }, [open]);

  const selected = targets.find((target) => target.id === value) ?? null;
  const company = targets.filter(
    (target) => target.ownershipScope === "Company"
  );
  const organizational = targets.filter(
    (target) => target.ownershipScope === "OrgUnit"
  );
  const groups = new Map<string, AlignmentTargetDto[]>();
  for (const target of organizational) {
    const key = target.orgUnitName ?? "Organizational direction";
    groups.set(key, [...(groups.get(key) ?? []), target]);
  }

  const renderTarget = (target: AlignmentTargetDto) => (
    <ComboboxItem
      key={target.id}
      value={target.id}
      className="items-start rounded-inset py-2"
    >
      <Target className="mt-0.5 size-4 text-primary" aria-hidden />
      <span className="min-w-0">
        <span className="block truncate font-medium text-foreground">
          {target.title}
        </span>
        <span className="block truncate text-xs text-muted-foreground">
          {target.accountablePersonName ?? "No owner"} ·{" "}
          {formatDate(target.startDate)} to {formatDate(target.endDate)}
        </span>
      </span>
    </ComboboxItem>
  );

  return (
    <Combobox
      items={[
        ...targets.map((target) => target.id),
        ...(includeStandalone ? ["__standalone__"] : []),
      ]}
      value={value}
      onValueChange={(next) => {
        if (next === "__standalone__") onStandalone?.();
        else if (typeof next === "string") onChange(next);
      }}
      filter={null}
      open={open}
      onOpenChange={setOpen}
    >
      <ComboboxTrigger
        disabled={disabled}
        render={
          <Button
            ref={triggerRef}
            variant="outline"
            className="h-auto min-h-9 w-full justify-between py-2 font-normal"
          />
        }
      >
        {value === "__standalone__" ? (
          <span className="inline-flex min-w-0 items-center gap-2 text-left font-medium text-info">
            <Waypoints className="size-4 shrink-0" aria-hidden />
            <span className="truncate">No alignment</span>
          </span>
        ) : selected ? (
          <span className="min-w-0 text-left">
            <span className="block truncate font-medium text-foreground">
              {selected.title}
            </span>
            <span className="block truncate text-xs text-muted-foreground">
              {selected.ownershipScope === "Company"
                ? "Company"
                : (selected.orgUnitName ?? "Organizational")}
            </span>
          </span>
        ) : (
          <span className="text-muted-foreground">
            Choose an upstream objective
          </span>
        )}
      </ComboboxTrigger>
      <ComboboxContent
        // Outside a dialog there is no container; a null container would keep the portal unmounted.
        container={container ?? undefined}
        className="max-w-(--anchor-width) min-w-(--anchor-width)"
      >
        <ComboboxList>
          {[...groups.entries()].map(([label, items]) => (
            <ComboboxGroup key={label}>
              <ComboboxLabel>{label}</ComboboxLabel>
              {items.map(renderTarget)}
            </ComboboxGroup>
          ))}
          {company.length > 0 ? (
            <ComboboxGroup>
              <ComboboxLabel>Company</ComboboxLabel>
              {company.map(renderTarget)}
            </ComboboxGroup>
          ) : null}
          {includeStandalone ? (
            <ComboboxGroup>
              <ComboboxLabel>Standalone</ComboboxLabel>
              <ComboboxItem value="__standalone__" className="items-start rounded-inset py-2">
                <Waypoints className="mt-0.5 size-4 shrink-0 text-info" aria-hidden />
                <span>
                  <span className="block font-medium text-foreground">
                    No alignment
                  </span>
                  <span className="block text-xs text-muted-foreground">
                    Create a team objective without an upstream link.
                  </span>
                </span>
              </ComboboxItem>
            </ComboboxGroup>
          ) : null}
        </ComboboxList>
      </ComboboxContent>
    </Combobox>
  );
}

function OwnerPicker({
  value,
  onChange,
  owners,
  loading,
  disabled,
}: {
  value: PickedEmployee | null;
  onChange: (owner: PickedEmployee) => void;
  owners: Array<{ id: string; name: string | null }>;
  loading: boolean;
  disabled: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const query = search.trim().toLowerCase();
  const filtered = query
    ? owners.filter((owner) => (owner.name ?? "").toLowerCase().includes(query))
    : owners;
  const options: EntityOption[] = filtered.map((owner) => ({
    id: owner.id,
    title: owner.name ?? "Team member",
    description: "Active team member at cycle start",
    media: (
      <Avatar className="size-6">
        <AvatarFallback className="text-[0.625rem]">
          {initials(owner.name)}
        </AvatarFallback>
      </Avatar>
    ),
  }));

  return (
    <EntityPicker
      selection={
        value
          ? {
              title: value.name,
              media: (
                <Avatar className="size-6">
                  <AvatarFallback className="text-[0.625rem]">
                    {initials(value.name)}
                  </AvatarFallback>
                </Avatar>
              ),
            }
          : null
      }
      selectedId={value?.id ?? null}
      options={options}
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) setSearch("");
      }}
      search={search}
      onSearchChange={setSearch}
      onSelect={(id) => {
        const owner = owners.find((candidate) => candidate.id === id);
        if (!owner) return;
        onChange({ id: owner.id, name: owner.name ?? "Team member" });
        setOpen(false);
        setSearch("");
      }}
      loading={loading}
      disabled={disabled}
      placeholder="Choose an accountable owner"
      placeholderIcon={<UserRound className="size-3.5" aria-hidden />}
      searchPlaceholder="Search team members…"
      emptyLabel="No eligible team members match your search."
      hint="No eligible team members."
    />
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
        "group flex items-start gap-3 rounded-surface border p-3.5 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
        active
          ? "border-primary bg-primary/[0.06] ring-1 ring-primary/40"
          : "border-border hover:border-primary/40 hover:bg-muted/40"
      )}
    >
      <span
        className={cn(
          "flex size-10 shrink-0 items-center justify-center rounded-control transition-colors",
          active
            ? "bg-primary-tint text-primary-ink"
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
