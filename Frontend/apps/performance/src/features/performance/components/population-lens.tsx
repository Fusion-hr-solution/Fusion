"use client";

import { useMemo, useState } from "react";
import {
  AlertTriangle,
  Building2,
  CheckCircle2,
  ChevronRight,
  MinusCircle,
  RotateCcw,
  UserRound,
  Users,
} from "lucide-react";
import { toast } from "sonner";
import type {
  ExclusionInput,
  OrganizationHierarchyNodeDto,
  OrgUnitSelectionInput,
  PopulationCandidateDto,
  PopulationDto,
  PopulationMode,
} from "@repo/api";
import { Button } from "@repo/ds/components/ui/button";
import { Checkbox } from "@repo/ds/components/ui/checkbox";
import { Input } from "@repo/ds/components/ui/input";
import { Switch } from "@repo/ds/components/ui/switch";
import { Label } from "@repo/ds/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@repo/ds/components/ui/popover";
import { AsyncButton, PageError, StatusBadge } from "@repo/ds/shell";
import { Skeleton } from "@repo/ds/components/ui/skeleton";
import { cn } from "@repo/ds/lib/utils";
import { usePopulation, usePopulationMutations, useOrgHierarchy } from "../api/use-performance";
import { READINESS_LABELS, formatDate } from "../lib";

export function PopulationLens({ cycleId, readOnly }: { cycleId: string; readOnly?: boolean }) {
  const population = usePopulation(cycleId);
  const { set, confirm } = usePopulationMutations(cycleId);

  if (population.isLoading) {
    return <div className="space-y-3">{[0, 1, 2].map((row) => <Skeleton key={row} className="h-16 w-full rounded-xl" />)}</div>;
  }
  if (population.error || !population.data) {
    return <PageError title="Population unavailable" description={population.error?.message} onRetry={population.refetch} />;
  }

  return (
    <PopulationLensBody
      data={population.data}
      readOnly={readOnly}
      onApply={(request) => set.mutateAsync(request)}
      onConfirm={() => confirm.mutateAsync()}
      confirming={confirm.isLoading}
    />
  );
}

function PopulationLensBody({
  data,
  readOnly,
  onApply,
  onConfirm,
  confirming,
}: {
  data: PopulationDto;
  readOnly?: boolean;
  onApply: (request: {
    mode: PopulationMode;
    orgUnitSelections: OrgUnitSelectionInput[];
    inclusions: string[];
    exclusions: ExclusionInput[];
  }) => Promise<PopulationDto>;
  onConfirm: () => Promise<PopulationDto>;
  confirming?: boolean;
}) {
  const { selection } = data;
  const [applying, setApplying] = useState(false);

  const exclusions = selection.exclusions;
  const inclusions = selection.inclusions;

  async function apply(next: Partial<{ mode: PopulationMode; orgUnitSelections: OrgUnitSelectionInput[]; exclusions: ExclusionInput[] }>) {
    setApplying(true);
    try {
      await onApply({
        mode: next.mode ?? selection.mode,
        orgUnitSelections: next.orgUnitSelections ?? selection.orgUnitSelections,
        inclusions,
        exclusions: next.exclusions ?? exclusions,
      });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not update the population.");
    } finally {
      setApplying(false);
    }
  }

  const needsAttention = data.candidates.filter((c) => !c.isExcluded && !c.isEligible);
  const ready = data.candidates.filter((c) => c.countsToRoster);
  const excluded = data.candidates.filter((c) => c.isExcluded);
  const blocked = needsAttention.length > 0 || ready.length === 0;

  return (
    <div className="space-y-6">
      {/* Scope chooser */}
      <div className="flex flex-col gap-4 rounded-2xl border bg-card p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-semibold">Who is in this Cycle</h3>
            <p className="text-sm text-muted-foreground">
              Eligibility resolves from the Organization as of {formatDate(selection.eligibilityDate)}.
            </p>
          </div>
          <div className="inline-flex rounded-lg border bg-muted/40 p-0.5">
            {(["AllActive", "ByScope"] as PopulationMode[]).map((mode) => (
              <button
                key={mode}
                type="button"
                disabled={readOnly || applying}
                onClick={() => apply({ mode, orgUnitSelections: mode === "AllActive" ? [] : selection.orgUnitSelections })}
                className={cn(
                  "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                  selection.mode === mode ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                )}
              >
                {mode === "AllActive" ? "All active employees" : "By organization"}
              </button>
            ))}
          </div>
        </div>

        {selection.mode === "ByScope" ? (
          <OrgScopePicker
            selections={selection.orgUnitSelections}
            disabled={readOnly || applying}
            onChange={(orgUnitSelections) => apply({ orgUnitSelections })}
          />
        ) : (
          <p className="flex items-center gap-2 rounded-lg bg-muted/30 px-3 py-2 text-sm text-muted-foreground">
            <Users className="size-3.5" aria-hidden /> Every active employee with a primary assignment is included.
          </p>
        )}
      </div>

      {/* Readiness summary */}
      <div className="grid gap-3 sm:grid-cols-3">
        <ReadinessStat tone="success" icon={CheckCircle2} value={ready.length} label="Ready to plan" emphasize />
        <ReadinessStat tone="warning" icon={AlertTriangle} value={needsAttention.length} label="Need attention" />
        <ReadinessStat tone="muted" icon={MinusCircle} value={excluded.length} label="Excluded" />
      </div>

      {/* Candidates */}
      <div className="space-y-4">
        {needsAttention.length > 0 ? (
          <CandidateGroup title="Need attention before activation">
            {needsAttention.map((candidate) => (
              <CandidateRow key={candidate.employeeId} candidate={candidate} readOnly={readOnly}
                action={
                  <ExcludeControl
                    disabled={readOnly || applying}
                    onExclude={(reason) => apply({ exclusions: [...exclusions, { employeeId: candidate.employeeId, reason }] })}
                  />
                }
              />
            ))}
          </CandidateGroup>
        ) : null}

        {excluded.length > 0 ? (
          <CandidateGroup title="Excluded">
            {excluded.map((candidate) => (
              <CandidateRow key={candidate.employeeId} candidate={candidate} readOnly={readOnly}
                action={
                  readOnly ? null : (
                    <Button variant="ghost" size="sm" disabled={applying}
                      onClick={() => apply({ exclusions: exclusions.filter((item) => item.employeeId !== candidate.employeeId) })}>
                      <RotateCcw className="size-3.5" data-icon="inline-start" /> Restore
                    </Button>
                  )
                }
              />
            ))}
          </CandidateGroup>
        ) : null}

        <CandidateGroup title={`Ready · ${ready.length}`} collapsible>
          {ready.map((candidate) => (
            <CandidateRow key={candidate.employeeId} candidate={candidate} readOnly={readOnly} />
          ))}
        </CandidateGroup>
      </div>

      {/* Confirm */}
      {!readOnly ? (
        <div className="flex flex-wrap items-center justify-between gap-3 border-t pt-5">
          <p className="text-sm text-muted-foreground">
            {selection.isConfirmed
              ? `Confirmed roster of ${ready.length} — frozen at activation.`
              : blocked
                ? "Resolve or exclude everyone who needs attention, then confirm."
                : `${ready.length} participant${ready.length === 1 ? "" : "s"} ready to confirm.`}
          </p>
          <AsyncButton
            pending={Boolean(confirming)}
            pendingLabel="Confirming…"
            disabled={blocked || applying}
            variant={selection.isConfirmed ? "outline" : "default"}
            onClick={async () => {
              try {
                await onConfirm();
                toast.success("Population confirmed.");
              } catch (error) {
                toast.error(error instanceof Error ? error.message : "Could not confirm the population.");
              }
            }}
          >
            {selection.isConfirmed ? "Re-confirm population" : "Confirm population"}
          </AsyncButton>
        </div>
      ) : null}
    </div>
  );
}

function ReadinessStat({
  tone,
  icon: Icon,
  value,
  label,
  emphasize,
}: {
  tone: "success" | "warning" | "muted";
  icon: typeof CheckCircle2;
  value: number;
  label: string;
  emphasize?: boolean;
}) {
  const toneClass = tone === "success" ? "text-success" : tone === "warning" ? "text-warning" : "text-muted-foreground";
  return (
    <div className={cn("rounded-xl border p-4", emphasize && value > 0 && "border-success/30 bg-success-subtle")}>
      <div className="flex items-center gap-1.5">
        <Icon className={cn("size-4", toneClass)} aria-hidden />
        <span className="text-sm text-muted-foreground">{label}</span>
      </div>
      <p className={cn("mt-1 text-3xl font-semibold tabular-nums", emphasize ? "text-foreground" : toneClass)}>{value}</p>
    </div>
  );
}

function CandidateGroup({
  title,
  collapsible,
  children,
}: {
  title: string;
  collapsible?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(!collapsible);
  return (
    <section className="rounded-2xl border">
      <button
        type="button"
        onClick={collapsible ? () => setOpen((value) => !value) : undefined}
        disabled={!collapsible}
        className={cn("flex w-full items-center justify-between px-4 py-3 text-left", collapsible && "hover:bg-muted/30")}
      >
        <span className="text-sm font-medium">{title}</span>
        {collapsible ? <ChevronRight className={cn("size-4 text-muted-foreground transition-transform", open && "rotate-90")} /> : null}
      </button>
      {open ? <div className="divide-y border-t">{children}</div> : null}
    </section>
  );
}

function CandidateRow({
  candidate,
  action,
}: {
  candidate: PopulationCandidateDto;
  readOnly?: boolean;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-3 px-4 py-2.5">
      <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground">
        <UserRound className="size-4" aria-hidden />
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{candidate.displayName}</p>
        <p className="truncate text-xs text-muted-foreground">
          {candidate.jobTitle ?? "—"}
          {candidate.orgUnitName ? ` · ${candidate.orgUnitName}` : ""}
          {candidate.byExplicitInclusion ? " · added manually" : ""}
        </p>
      </div>
      <div className="flex items-center gap-2">
        {candidate.isExcluded ? (
          <span className="max-w-40 truncate text-xs text-muted-foreground">{candidate.exclusionReason}</span>
        ) : (
          candidate.issues.map((issue) => (
            <StatusBadge key={issue.code} tone={issue.isHard ? "warning" : "muted"}>
              {READINESS_LABELS[issue.code]}
            </StatusBadge>
          ))
        )}
        {action}
      </div>
    </div>
  );
}

function ExcludeControl({ disabled, onExclude }: { disabled?: boolean; onExclude: (reason: string) => void }) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" disabled={disabled}>
          <MinusCircle className="size-3.5" data-icon="inline-start" /> Exclude
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-72 space-y-2">
        <Label htmlFor="exclude-reason" className="text-sm">Reason for excluding</Label>
        <Input id="exclude-reason" value={reason} onChange={(event) => setReason(event.target.value)} placeholder="On leave, contractor…" autoFocus />
        <div className="flex justify-end gap-2">
          <Button variant="ghost" size="sm" onClick={() => setOpen(false)}>Cancel</Button>
          <Button
            size="sm"
            disabled={reason.trim().length === 0}
            onClick={() => {
              onExclude(reason.trim());
              setReason("");
              setOpen(false);
            }}
          >
            Exclude
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}

function OrgScopePicker({
  selections,
  disabled,
  onChange,
}: {
  selections: OrgUnitSelectionInput[];
  disabled?: boolean;
  onChange: (selections: OrgUnitSelectionInput[]) => void;
}) {
  const hierarchy = useOrgHierarchy();
  const includeDescendants = selections.length === 0 ? true : selections.every((selection) => selection.includeDescendants);
  const selected = useMemo(() => new Set(selections.map((selection) => selection.orgUnitId)), [selections]);

  function toggleUnit(id: string) {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    onChange([...next].map((orgUnitId) => ({ orgUnitId, includeDescendants })));
  }

  function setDescendants(value: boolean) {
    onChange([...selected].map((orgUnitId) => ({ orgUnitId, includeDescendants: value })));
  }

  if (hierarchy.isLoading) return <Skeleton className="h-40 w-full rounded-xl" />;
  if (hierarchy.error || !hierarchy.data) {
    return <PageError title="Organization unavailable" description={hierarchy.error?.message} onRetry={hierarchy.refetch} />;
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
          <Building2 className="size-3.5" aria-hidden /> Select organizational units
        </p>
        <div className="flex items-center gap-2">
          <Switch id="descendants" checked={includeDescendants} disabled={disabled} onCheckedChange={setDescendants} />
          <Label htmlFor="descendants" className="text-sm text-muted-foreground">Include sub-units</Label>
        </div>
      </div>
      <div className="max-h-64 overflow-y-auto rounded-xl border p-2">
        {hierarchy.data.roots.map((node) => (
          <OrgNode key={node.unit.id} node={node} depth={0} selected={selected} disabled={disabled} onToggle={toggleUnit} />
        ))}
      </div>
    </div>
  );
}

function OrgNode({
  node,
  depth,
  selected,
  disabled,
  onToggle,
}: {
  node: OrganizationHierarchyNodeDto;
  depth: number;
  selected: Set<string>;
  disabled?: boolean;
  onToggle: (id: string) => void;
}) {
  return (
    <div>
      <label
        className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 hover:bg-muted/40"
        style={{ paddingLeft: `${depth * 16 + 8}px` }}
      >
        <Checkbox checked={selected.has(node.unit.id)} disabled={disabled} onCheckedChange={() => onToggle(node.unit.id)} />
        <span className="text-sm">{node.unit.name}</span>
      </label>
      {node.children.map((child) => (
        <OrgNode key={child.unit.id} node={child} depth={depth + 1} selected={selected} disabled={disabled} onToggle={onToggle} />
      ))}
    </div>
  );
}
