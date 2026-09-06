"use client";

import { useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  ArrowUpRight,
  Building2,
  Gauge,
  Info,
  ListChecks,
  Percent,
  Sigma,
  Target,
  TrendingDown,
  TrendingUp,
  UserRound,
} from "lucide-react";
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
import {
  ButtonGroup,
  ButtonGroupText,
} from "@repo/ds/components/ui/button-group";
import { DatePicker } from "@repo/ds/components/ui/date-picker";
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
import { PageContainer, StatusBadge } from "@repo/ds/shell";
import { cn } from "@repo/ds/lib/utils";
import { parseNumeric } from "../../lib";
import { CycleContextBar } from "../cycle-context-bar";
import { PerformancePageHeading } from "../performance-page-heading";
import {
  EmployeePicker,
  OrgUnitPicker,
  type PickedEmployee,
  type PickedOrgUnit,
} from "@repo/workforce-ui";
import { initials, scopeLabel } from "./goals-lib";
import { useGoalMutations } from "../../api/use-performance";
import {
  MilestoneEditor,
  milestonesFromMeasurement,
  type MilestoneRow,
} from "../measurement/milestone-editor";

const GOALS_HREF = "/goals";

/**
 * The Create / Edit Organizational Objective composer — a focused, deep-linkable authoring
 * surface (route: /goals/new?parent=<id> and /goals/<id>/edit), not a modal. Its grammar is
 * Parent direction → Objective definition → Scope & accountability → "How will progress be
 * measured?" → measurement configuration → Draft / Publish. Scope and accountability are kept
 * visibly distinct concepts; Direct vs Calculated is the single progress-source question, and
 * the three real Direct methods (manual %, numeric target, weighted milestones) sit beneath it.
 * Draft is a resumable state, and the happy path ends in Publish once requirements are met.
 */
export function OrgObjectiveComposer({
  cycle,
  parent,
  objective,
  defaultAccountable,
  defaultOrgUnit,
}: {
  cycle: CycleSummaryDto;
  parent: GoalNodeDto;
  objective?: GoalDetailDto;
  /** Convenience default for a new objective's accountable person (the signed-in user); editable. */
  defaultAccountable?: PickedEmployee | null;
  /** Preselected organizational scope when launched from a scoped landing (the actor's own unit); editable. */
  defaultOrgUnit?: PickedOrgUnit | null;
}) {
  const router = useRouter();
  const mutations = useGoalMutations(cycle.id);
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
  if (!isEdit && orgUnit === null) missing.push("an organizational scope");
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

  function returnToGoals() {
    router.push(`${GOALS_HREF}?focus=${parent.id}`);
  }

  async function handleSaveDraft() {
    setBusy("draft");
    try {
      if (isEdit) {
        await mutations.update.mutateAsync({
          objectiveId: objective!.node.id,
          request: updateRequest(),
        });
      } else {
        await mutations.create.mutateAsync(createRequest());
      }
      toast.success("Draft saved.");
      returnToGoals();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Could not save the draft."
      );
      setBusy(null);
    }
  }

  async function handlePublish() {
    setBusy("publish");
    try {
      let objectiveId: string;
      if (isEdit) {
        objectiveId = objective!.node.id;
        await mutations.update.mutateAsync({
          objectiveId,
          request: updateRequest(),
        });
      } else {
        const created = await mutations.create.mutateAsync(createRequest());
        objectiveId = created.node.id;
      }
      try {
        await mutations.publish.mutateAsync(objectiveId);
      } catch (publishError) {
        // The draft is safely persisted; publishing is what failed. Keep the work by taking the
        // author to that draft's editor rather than discarding it.
        toast.error(
          publishError instanceof Error
            ? publishError.message
            : "The draft was saved but could not be published."
        );
        router.push(`${GOALS_HREF}/${objectiveId}/edit`);
        return;
      }
      toast.success("Published as organizational direction.");
      returnToGoals();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Could not save the objective."
      );
      setBusy(null);
    }
  }

  return (
    <PageContainer width="narrow">
      <CycleContextBar cycle={cycle} />
      <PerformancePageHeading
        back={{ href: GOALS_HREF, label: "Organization Goals" }}
        eyebrow={
          isEdit ? (
            <StatusBadge tone="muted" dot>
              Draft
            </StatusBadge>
          ) : (
            <span className="type-eyebrow text-muted-foreground">
              New organizational objective
            </span>
          )
        }
        title={isEdit ? "Edit objective" : "Create organizational objective"}
      />

      <ParentDirectionBand parent={parent} />

      <div className="mt-6 space-y-6">
        <Block title="Objective details">
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
          <div className="h-px bg-border/60" />

          {/* Scope, accountable person, and dates complete the objective's definition; scope and
              accountability remain two distinct concepts, shown side by side. */}
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label className="flex items-center gap-1.5">
                <Building2
                  className="size-3.5 text-muted-foreground"
                  aria-hidden
                />
                Organizational scope <span className="text-destructive">*</span>
              </Label>
              {isEdit ? (
                <div className="flex h-8 items-center gap-2 rounded-xl border border-border bg-muted/40 px-2.5 text-sm">
                  <span className="truncate font-medium">
                    {node?.orgUnitName ?? "Owning unit"}
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
        </Block>

        <Block title="Measurement">
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
            <div className="space-y-4">
              <div className="space-y-2">
                <p className="type-eyebrow text-muted-foreground">
                  Measure directly using
                </p>
                <div className="grid grid-cols-3 gap-2.5">
                  <MethodChip
                    active={method === "NumericTarget"}
                    icon={Target}
                    title="Numeric target"
                    onClick={() => setMethod("NumericTarget")}
                  />
                  <MethodChip
                    active={method === "WeightedMilestones"}
                    icon={ListChecks}
                    title="Weighted milestones"
                    onClick={() => setMethod("WeightedMilestones")}
                  />
                  <MethodChip
                    active={method === "ManualPercentage"}
                    icon={Percent}
                    title="Manual percentage"
                    onClick={() => setMethod("ManualPercentage")}
                  />
                </div>
              </div>

              {method === "NumericTarget" ? (
                <NumericTargetEditor
                  baseline={baseline}
                  target={target}
                  unit={unit}
                  direction={direction}
                  baselineInvalid={base.invalid}
                  targetInvalid={tgt.invalid}
                  numericInvalid={numericInvalid}
                  sameValue={sameValue}
                  onBaseline={setBaseline}
                  onTarget={setTarget}
                  onUnit={setUnit}
                  onDirection={setDirection}
                />
              ) : null}

              {method === "WeightedMilestones" ? (
                <MilestoneEditor
                  milestones={milestones}
                  weightSum={weightSum}
                  onChange={setMilestones}
                  readyLabel="Ready to publish"
                />
              ) : null}

              {method === "ManualPercentage" ? (
                <MeasureNote icon={Percent} title="Updated manually">
                  The accountable person updates a single completion percentage
                  over the period.
                </MeasureNote>
              ) : null}
            </div>
          ) : (
            <MeasureNote icon={Info} title="You’ll add contributors later">
              This objective&rsquo;s progress adds up from the objectives beneath
              it. Once those are published, you choose how much each one counts
              toward the total.
            </MeasureNote>
          )}
        </Block>
      </div>

      <ActionBar
        busy={busy}
        canSaveDraft={canSaveDraft}
        canPublish={canPublish}
        onCancel={() => router.push(GOALS_HREF)}
        onSaveDraft={handleSaveDraft}
        onPublish={handlePublish}
      />
    </PageContainer>
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

// ── Layout ──────────────────────────────────────────────────────────────────────

function Block({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-border bg-card p-5 sm:p-6">
      <h2 className="type-section-title text-foreground">{title}</h2>
      <div className="mt-4 space-y-4">{children}</div>
    </section>
  );
}

// ── Measurement note (shared passive-mode explainer) ─────────────────────────────
// Both passive measurement modes — Manual percentage and Calculate-from-contributors —
// have nothing to configure, so each is presented with the same icon + title + body note.

function MeasureNote({
  icon: Icon,
  title,
  children,
}: {
  icon: typeof Info;
  title: string;
  children: ReactNode;
}) {
  return (
    <div className="flex gap-2.5 rounded-xl border border-info/25 bg-info-subtle px-4 py-3">
      <Icon className="mt-0.5 size-4 shrink-0 text-info" aria-hidden />
      <div className="text-sm">
        <p className="font-medium text-foreground">{title}</p>
        <p className="mt-0.5 text-muted-foreground">{children}</p>
      </div>
    </div>
  );
}

// ── Progress-source card (2, horizontal: bigger icon + title + one line) ──────────

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

// ── Direct-method chip (3, one row, icon + label only) ────────────────────────────

function MethodChip({
  active,
  icon: Icon,
  title,
  onClick,
}: {
  active: boolean;
  icon: typeof Gauge;
  title: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "group flex items-center gap-2 rounded-xl border px-3 py-2.5 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
        active
          ? "border-primary bg-primary/[0.06] ring-1 ring-primary/40"
          : "border-border hover:border-primary/40 hover:bg-muted/40"
      )}
    >
      <Icon
        className={cn(
          "size-4 shrink-0",
          active
            ? "text-primary"
            : "text-muted-foreground group-hover:text-foreground"
        )}
        aria-hidden
      />
      <span className="text-sm font-medium text-foreground">{title}</span>
    </button>
  );
}

// ── Numeric target editor ─────────────────────────────────────────────────────────

function NumericTargetEditor({
  baseline,
  target,
  unit,
  direction,
  baselineInvalid,
  targetInvalid,
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
  baselineInvalid: boolean;
  targetInvalid: boolean;
  numericInvalid: boolean;
  sameValue: boolean;
  onBaseline: (v: string) => void;
  onTarget: (v: string) => void;
  onUnit: (v: string) => void;
  onDirection: (v: ImprovementDirection) => void;
}) {
  const suffix = unitSuffix(unit);
  return (
    <div className="space-y-3 rounded-xl border border-border/70 bg-muted/30 p-4">
      <div className="grid grid-cols-[1fr_auto_1fr] items-end gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="og-base">
            Baseline <span className="text-destructive">*</span>
          </Label>
          <ButtonGroup className="w-full">
            <Input
              id="og-base"
              inputMode="decimal"
              value={baseline}
              onChange={(event) => onBaseline(event.target.value)}
              placeholder="40"
              aria-invalid={baselineInvalid}
              className="text-right tabular-nums"
            />
            {suffix ? <ButtonGroupText>{suffix}</ButtonGroupText> : null}
          </ButtonGroup>
        </div>
        <ArrowRight className="mb-3 size-4 text-muted-foreground" aria-hidden />
        <div className="space-y-1.5">
          <Label htmlFor="og-target">
            Target <span className="text-destructive">*</span>
          </Label>
          <ButtonGroup className="w-full">
            <Input
              id="og-target"
              inputMode="decimal"
              value={target}
              onChange={(event) => onTarget(event.target.value)}
              placeholder="70"
              aria-invalid={targetInvalid}
              className="text-right tabular-nums"
            />
            {suffix ? <ButtonGroupText>{suffix}</ButtonGroupText> : null}
          </ButtonGroup>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="og-unit">
            Unit <span className="text-destructive">*</span>
          </Label>
          <Input
            id="og-unit"
            value={unit}
            onChange={(event) => onUnit(event.target.value)}
            placeholder="%, days, NPS…"
          />
        </div>
        <div className="space-y-1.5">
          <Label>Direction</Label>
          <Select
            value={direction}
            onValueChange={(next) => onDirection(next as ImprovementDirection)}
          >
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="Increase">
                <TrendingUp className="text-muted-foreground" aria-hidden />
                Higher is better
              </SelectItem>
              <SelectItem value="Decrease">
                <TrendingDown className="text-muted-foreground" aria-hidden />
                Lower is better
              </SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      {numericInvalid ? (
        <p className="text-sm text-destructive">
          Enter a number — put units like M€ or % in the Unit field.
        </p>
      ) : sameValue ? (
        <p className="text-sm text-destructive">
          Baseline and target must differ.
        </p>
      ) : null}
    </div>
  );
}

/** The unit shown as an attached suffix on the numeric inputs — only when short enough to read inline. */
function unitSuffix(unit: string): string | null {
  const label = unit.trim();
  return label !== "" && label.length <= 4 ? label : null;
}

// ── Action bar ────────────────────────────────────────────────────────────────────

function ActionBar({
  busy,
  canSaveDraft,
  canPublish,
  onCancel,
  onSaveDraft,
  onPublish,
}: {
  busy: null | "draft" | "publish";
  canSaveDraft: boolean;
  canPublish: boolean;
  onCancel: () => void;
  onSaveDraft: () => void;
  onPublish: () => void;
}) {
  return (
    <div className="sticky bottom-0 z-10 mt-10 -mx-6 border-t border-border bg-background/95 px-6 py-3.5 backdrop-blur supports-[backdrop-filter]:bg-background/80">
      <div className="flex items-center justify-between gap-3">
        <Button variant="ghost" onClick={onCancel} disabled={busy !== null}>
          Cancel
        </Button>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={onSaveDraft}
            disabled={!canSaveDraft || busy !== null}
          >
            {busy === "draft" ? "Saving…" : "Save as draft"}
          </Button>
          <Button onClick={onPublish} disabled={!canPublish || busy !== null}>
            {busy === "publish" ? "Publishing…" : "Publish objective"}
          </Button>
        </div>
      </div>
    </div>
  );
}
