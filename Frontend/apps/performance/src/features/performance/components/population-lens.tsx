"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import {
  Building2,
  ChevronLeft,
  ChevronRight,
  CircleCheck,
  Loader2,
  MinusCircle,
  RotateCcw,
  Search,
  TriangleAlert,
  UserMinus,
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
import { useOrgHierarchy } from "@repo/workforce-ui";
import { usePopulation, usePopulationMutations } from "../api/use-performance";
import { READINESS_LABELS, formatDate } from "../lib";
import { computeOrgStates, type OrgUnitState } from "./population-lib";

const ROSTER_RENDER_CAP = 50;

// The DS checkbox indicator hard-codes a check glyph; for a genuinely partial
// selection draw a dash instead so indeterminate never reads as fully selected.
const INDETERMINATE_DASH =
  "border-primary [&_svg]:hidden before:absolute before:left-1/2 before:top-1/2 before:h-0.5 before:w-2 before:-translate-x-1/2 before:-translate-y-1/2 before:rounded-full before:bg-primary";

export function PopulationLens({ cycleId, readOnly }: { cycleId: string; readOnly?: boolean }) {
  const population = usePopulation(cycleId);
  const { set, confirm } = usePopulationMutations(cycleId);

  if (population.isLoading) {
    return (
      <div className="space-y-3">
        {[0, 1, 2].map((row) => (
          <Skeleton key={row} className="h-16 w-full rounded-xl" />
        ))}
      </div>
    );
  }
  if (population.error || !population.data) {
    return (
      <PageError
        title="Population unavailable"
        description={population.error?.message}
        onRetry={population.refetch}
      />
    );
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

  async function apply(
    next: Partial<{
      mode: PopulationMode;
      orgUnitSelections: OrgUnitSelectionInput[];
      exclusions: ExclusionInput[];
    }>
  ) {
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
  const inScope = data.candidates.filter((c) => !c.isExcluded).length;
  const blocked = needsAttention.length > 0 || ready.length === 0;
  const byScope = selection.mode === "ByScope";

  return (
    <div className="space-y-5">
      {/* Mode + eligibility */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="type-section-title text-foreground">Who is in this Cycle</h2>
          <p className="text-sm text-muted-foreground">
            Eligibility resolves from the Organization as of {formatDate(selection.eligibilityDate)}.
          </p>
        </div>
        <div className="inline-flex rounded-lg border border-border bg-muted/40 p-0.5">
          {(["AllActive", "ByScope"] as PopulationMode[]).map((mode) => (
            <button
              key={mode}
              type="button"
              disabled={readOnly || applying}
              onClick={() =>
                apply({ mode, orgUnitSelections: mode === "AllActive" ? [] : selection.orgUnitSelections })
              }
              className={cn(
                "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                selection.mode === mode
                  ? "bg-primary text-primary-foreground shadow-raised"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {mode === "AllActive" ? "All active" : "By organization"}
            </button>
          ))}
        </div>
      </div>

      {/* Master–detail: scope on the left, people on the right — one equal-height workspace. */}
      <div className={cn(byScope && "grid gap-6 lg:grid-cols-[320px_1fr]")}>
        {byScope ? (
          <OrgScopePicker
            selections={selection.orgUnitSelections}
            disabled={readOnly}
            onChange={(orgUnitSelections) => apply({ orgUnitSelections })}
          />
        ) : null}

        <PeopleInScope
          needsAttention={needsAttention}
          ready={ready}
          excluded={excluded}
          readOnly={readOnly}
          applying={applying}
          fill={byScope}
          onExclude={(employeeId, reason) =>
            apply({ exclusions: [...exclusions, { employeeId, reason }] })
          }
          onExcludeMany={(employeeIds, reason) =>
            apply({
              exclusions: [
                ...exclusions,
                ...employeeIds.map((employeeId) => ({ employeeId, reason })),
              ],
            })
          }
          onRestore={(employeeId) =>
            apply({ exclusions: exclusions.filter((item) => item.employeeId !== employeeId) })
          }
        />
      </div>

      {/* Confirm — the readiness counts live beside the action. */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-5">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-sm">
          <CountStat
            icon={Users}
            value={inScope}
            label="In scope"
            className="text-foreground"
          />
          <CountStat
            icon={CircleCheck}
            value={ready.length}
            label="Ready"
            className="text-success"
          />
          {needsAttention.length > 0 ? (
            <CountStat
              icon={TriangleAlert}
              value={needsAttention.length}
              label="Need attention"
              className="text-destructive"
            />
          ) : null}
          {excluded.length > 0 ? (
            <CountStat
              icon={MinusCircle}
              value={excluded.length}
              label="Excluded"
              className="text-muted-foreground"
            />
          ) : null}
        </div>
        {!readOnly ? (
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
        ) : null}
      </div>
    </div>
  );
}

/** An icon-led readiness count. The word is the accessible name; the icon carries meaning at a glance. */
function CountStat({
  icon: Icon,
  value,
  label,
  className,
}: {
  icon: typeof Users;
  value: number;
  label: string;
  className?: string;
}) {
  return (
    <span className={cn("inline-flex items-center gap-1.5", className)} title={label}>
      <Icon className="size-4 shrink-0" aria-hidden />
      <span className="font-medium tabular-nums">{value}</span>
      <span className="sr-only">{label}</span>
    </span>
  );
}

function PeopleInScope({
  needsAttention,
  ready,
  excluded,
  readOnly,
  applying,
  fill,
  onExclude,
  onExcludeMany,
  onRestore,
}: {
  needsAttention: PopulationCandidateDto[];
  ready: PopulationCandidateDto[];
  excluded: PopulationCandidateDto[];
  readOnly?: boolean;
  applying?: boolean;
  /** Fill the shared master-detail height (paired with the Organization card). */
  fill?: boolean;
  onExclude: (employeeId: string, reason: string) => void;
  onExcludeMany: (employeeIds: string[], reason: string) => void;
  onRestore: (employeeId: string) => void;
}) {
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(0);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const q = query.trim().toLowerCase();
  const match = (c: PopulationCandidateDto) =>
    q === "" ||
    `${c.displayName} ${c.jobTitle ?? ""} ${c.orgUnitName ?? ""}`.toLowerCase().includes(q);

  const filteredReady = ready.filter(match);
  const filteredExcluded = excluded.filter(match);
  const selectable = !readOnly;

  // Page through the ready list; excluded rows always show below the current page.
  const pageCount = Math.max(1, Math.ceil(filteredReady.length / ROSTER_RENDER_CAP));
  const clampedPage = Math.min(page, pageCount - 1);
  useEffect(() => {
    setPage(0);
  }, [q, ready.length]);
  const pageStart = clampedPage * ROSTER_RENDER_CAP;
  const rosterRendered = filteredReady.slice(pageStart, pageStart + ROSTER_RENDER_CAP);

  // A person leaves the in-scope list once excluded, so prune them from the
  // selection rather than letting stale ids linger.
  const readyIds = useMemo(() => new Set(ready.map((c) => c.employeeId)), [ready]);
  useEffect(() => {
    setSelected((prev) => {
      const next = new Set([...prev].filter((id) => readyIds.has(id)));
      return next.size === prev.size ? prev : next;
    });
  }, [readyIds]);

  const filteredReadyIds = filteredReady.map((c) => c.employeeId);
  const allFilteredSelected =
    filteredReadyIds.length > 0 && filteredReadyIds.every((id) => selected.has(id));
  const someFilteredSelected = filteredReadyIds.some((id) => selected.has(id));
  const hasSelection = selected.size > 0;

  const toggleOne = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  const toggleAllFiltered = () =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (allFilteredSelected) filteredReadyIds.forEach((id) => next.delete(id));
      else filteredReadyIds.forEach((id) => next.add(id));
      return next;
    });
  const clearSelection = () => setSelected(new Set());

  return (
    <div className={cn("flex flex-col gap-4", fill && "lg:h-[26rem] lg:min-h-0")}>
      {needsAttention.length > 0 ? (
        <section className="flex shrink-0 flex-col overflow-hidden rounded-2xl border border-warning/40">
          <p className="border-b border-warning/30 bg-warning-subtle px-4 py-2.5 text-sm font-medium text-warning">
            Resolve before activation · {needsAttention.length}
          </p>
          <div className="max-h-44 divide-y divide-border overflow-y-auto">
            {needsAttention.map((candidate) => (
              <CandidateRow
                key={candidate.employeeId}
                candidate={candidate}
                action={
                  <ExcludeReasonPopover
                    onConfirm={(reason) => onExclude(candidate.employeeId, reason)}
                    trigger={
                      <Button variant="outline" size="sm" disabled={readOnly || applying}>
                        <MinusCircle className="size-3.5" data-icon="inline-start" /> Exclude
                      </Button>
                    }
                  />
                }
              />
            ))}
          </div>
        </section>
      ) : null}

      <section
        className={cn(
          "flex flex-col rounded-2xl border border-border",
          fill && "lg:min-h-0 lg:flex-1"
        )}
      >
        <div className="flex items-center gap-3 border-b border-border px-4 py-2.5">
          <div className="flex shrink-0 items-center gap-3">
            {selectable ? (
              <Checkbox
                aria-label="Select all people in scope"
                checked={allFilteredSelected ? true : someFilteredSelected ? "indeterminate" : false}
                disabled={filteredReadyIds.length === 0}
                onCheckedChange={toggleAllFiltered}
                className={cn(someFilteredSelected && !allFilteredSelected && INDETERMINATE_DASH)}
              />
            ) : null}
            <p className="whitespace-nowrap text-sm font-medium text-foreground">
              {hasSelection ? (
                <>
                  <span className="tabular-nums">{selected.size}</span> selected
                </>
              ) : (
                <>
                  In scope ·{" "}
                  <span className="tabular-nums text-muted-foreground">{ready.length}</span>
                </>
              )}
            </p>
          </div>
          <div className="flex min-w-0 flex-1 items-center justify-end gap-2">
            {hasSelection ? (
              <>
                <ExcludeReasonPopover
                  onConfirm={(reason) => {
                    onExcludeMany([...selected], reason);
                    clearSelection();
                  }}
                  trigger={
                    <Button size="sm" disabled={applying} className="shrink-0">
                      <MinusCircle className="size-3.5" data-icon="inline-start" /> Exclude{" "}
                      {selected.size}
                    </Button>
                  }
                />
                <Button variant="ghost" size="sm" onClick={clearSelection} className="shrink-0">
                  Clear
                </Button>
              </>
            ) : null}
            <div className="relative min-w-0 flex-1 sm:max-w-52">
              <Search
                className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground"
                aria-hidden
              />
              <Input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search people"
                className="h-8 w-full pl-8 text-sm"
                aria-label="Search people in scope"
              />
            </div>
          </div>
        </div>

        <div
          className={cn(
            "min-h-0 flex-1 divide-y divide-border overflow-y-auto",
            !fill && "max-h-[26rem]"
          )}
        >
          {rosterRendered.length === 0 && filteredExcluded.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center gap-2 px-4 py-10 text-center">
              {applying ? (
                <Loader2
                  className="size-6 animate-spin text-muted-foreground/60"
                  role="status"
                  aria-label="Updating"
                />
              ) : (
                <UserRound className="size-6 text-muted-foreground/50" aria-hidden />
              )}
              <p className="text-sm text-muted-foreground">
                {q ? `No one matches “${query.trim()}”.` : "No one is in scope yet."}
              </p>
              {q ? (
                <Button variant="ghost" size="sm" onClick={() => setQuery("")}>
                  Clear search
                </Button>
              ) : null}
            </div>
          ) : (
            <>
              {rosterRendered.map((candidate) => (
                <CandidateRow
                  key={candidate.employeeId}
                  candidate={candidate}
                  leading={
                    selectable ? (
                      <Checkbox
                        aria-label={`Select ${candidate.displayName}`}
                        checked={selected.has(candidate.employeeId)}
                        onCheckedChange={() => toggleOne(candidate.employeeId)}
                      />
                    ) : null
                  }
                  action={
                    selectable ? (
                      <ExcludeReasonPopover
                        onConfirm={(reason) => onExclude(candidate.employeeId, reason)}
                        trigger={
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            disabled={applying}
                            aria-label={`Exclude ${candidate.displayName}`}
                            title="Exclude from cycle"
                            className="text-muted-foreground hover:text-foreground"
                          >
                            <UserMinus className="size-4" />
                          </Button>
                        }
                      />
                    ) : null
                  }
                />
              ))}
              {filteredExcluded.map((candidate) => (
                <CandidateRow
                  key={candidate.employeeId}
                  candidate={candidate}
                  action={
                    readOnly ? null : (
                      <Button
                        variant="ghost"
                        size="sm"
                        disabled={applying}
                        onClick={() => onRestore(candidate.employeeId)}
                      >
                        <RotateCcw className="size-3.5" data-icon="inline-start" /> Restore
                      </Button>
                    )
                  }
                />
              ))}
            </>
          )}
        </div>

        {filteredReady.length > ROSTER_RENDER_CAP ? (
          <div className="flex items-center justify-between gap-3 border-t border-border px-4 py-2">
            <p className="text-xs text-muted-foreground tabular-nums">
              {pageStart + 1}–{Math.min(pageStart + ROSTER_RENDER_CAP, filteredReady.length)} of{" "}
              {filteredReady.length}
            </p>
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label="Previous page"
                disabled={clampedPage === 0}
                onClick={() => setPage((p) => Math.max(0, p - 1))}
              >
                <ChevronLeft className="size-4" />
              </Button>
              <span className="px-1 text-xs text-muted-foreground tabular-nums">
                {clampedPage + 1} / {pageCount}
              </span>
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label="Next page"
                disabled={clampedPage >= pageCount - 1}
                onClick={() => setPage((p) => Math.min(pageCount - 1, p + 1))}
              >
                <ChevronRight className="size-4" />
              </Button>
            </div>
          </div>
        ) : null}
      </section>
    </div>
  );
}

function CandidateRow({
  candidate,
  leading,
  action,
}: {
  candidate: PopulationCandidateDto;
  leading?: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <div className={cn("group flex items-center gap-3 px-4 py-2.5", candidate.isExcluded && "opacity-60")}>
      {leading ? <span className="flex shrink-0 items-center">{leading}</span> : null}
      <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground">
        <UserRound className="size-4" aria-hidden />
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-foreground">{candidate.displayName}</p>
        <p className="truncate text-xs text-muted-foreground">
          {candidate.jobTitle ?? "—"}
          {candidate.orgUnitName ? ` · ${candidate.orgUnitName}` : ""}
          {candidate.byExplicitInclusion ? " · added manually" : ""}
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        {candidate.isExcluded ? (
          <span className="max-w-40 truncate text-xs text-muted-foreground">
            {candidate.exclusionReason}
          </span>
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

/** A reason-gated exclude popover behind an arbitrary trigger (row icon, labeled button, bulk bar). */
function ExcludeReasonPopover({
  trigger,
  onConfirm,
}: {
  trigger: React.ReactNode;
  onConfirm: (reason: string) => void;
}) {
  const inputId = useId();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) setReason("");
      }}
    >
      <PopoverTrigger asChild>{trigger}</PopoverTrigger>
      <PopoverContent align="end" className="w-72 space-y-2">
        <Label htmlFor={inputId} className="text-sm">
          Reason for excluding
        </Label>
        <Input
          id={inputId}
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          placeholder="On leave, contractor…"
          autoFocus
        />
        <div className="flex justify-end gap-2">
          <Button variant="ghost" size="sm" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button
            size="sm"
            disabled={reason.trim().length === 0}
            onClick={() => {
              onConfirm(reason.trim());
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
  // The tree is the sole editor of the scope during setup, so it owns the selection
  // locally and responds instantly. The server sync (which recomputes the people
  // roster) runs via onChange in the background — a click never waits on it, and
  // building on local state means rapid clicks can't be lost to a lagging response.
  const [draft, setDraft] = useState<OrgUnitSelectionInput[]>(selections);
  const includeDescendants =
    draft.length === 0 ? true : draft.every((selection) => selection.includeDescendants);
  const selected = useMemo(
    () => new Set(draft.map((selection) => selection.orgUnitId)),
    [draft]
  );
  const states = useMemo(
    () =>
      hierarchy.data
        ? computeOrgStates(hierarchy.data.roots, selected, includeDescendants)
        : new Map<string, OrgUnitState>(),
    [hierarchy.data, selected, includeDescendants]
  );

  // The tree updates instantly; the server sync is debounced so a burst of clicks
  // coalesces into one recompute (no request races, far fewer round-trips).
  const syncTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(
    () => () => {
      if (syncTimer.current) clearTimeout(syncTimer.current);
    },
    []
  );
  function commit(next: OrgUnitSelectionInput[]) {
    setDraft(next);
    if (syncTimer.current) clearTimeout(syncTimer.current);
    syncTimer.current = setTimeout(() => onChange(next), 250);
  }

  function toggleUnit(id: string) {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    commit([...next].map((orgUnitId) => ({ orgUnitId, includeDescendants })));
  }

  function setDescendants(value: boolean) {
    commit([...selected].map((orgUnitId) => ({ orgUnitId, includeDescendants: value })));
  }

  const dataReady = Boolean(hierarchy.data);

  return (
    <div className="flex flex-col rounded-2xl border border-border lg:h-[26rem]">
      <div className="flex items-center justify-between gap-2 border-b border-border px-3 py-2.5">
        <p className="flex items-center gap-1.5 text-sm font-medium text-foreground">
          <Building2 className="size-3.5 text-muted-foreground" aria-hidden /> Organization
        </p>
        <div className="flex items-center gap-2">
          <Switch
            id="descendants"
            checked={includeDescendants}
            disabled={disabled || !dataReady}
            onCheckedChange={setDescendants}
          />
          <Label htmlFor="descendants" className="text-xs text-muted-foreground">
            Include sub-units
          </Label>
        </div>
      </div>
      <div className="min-h-0 max-h-72 flex-1 overflow-y-auto p-2 lg:max-h-none">
        {hierarchy.isLoading ? (
          <div className="space-y-2 p-1" aria-busy aria-label="Loading organization">
            {Array.from({ length: 6 }).map((_, i) => (
              <div
                key={i}
                className="flex items-center gap-2"
                style={{ paddingLeft: `${(i % 3) * 14}px` }}
              >
                <Skeleton className="size-4 shrink-0 rounded-sm" />
                <Skeleton className="h-4 w-32 max-w-[70%]" />
              </div>
            ))}
          </div>
        ) : hierarchy.error || !hierarchy.data ? (
          <div className="flex h-full flex-col items-center justify-center gap-2 px-4 py-8 text-center">
            <Building2 className="size-6 text-muted-foreground/50" aria-hidden />
            <p className="text-sm text-muted-foreground">Organization couldn&apos;t load.</p>
            <Button variant="outline" size="sm" onClick={() => hierarchy.refetch()}>
              Try again
            </Button>
          </div>
        ) : (
          hierarchy.data.roots.map((node) => (
            <OrgNode
              key={node.unit.id}
              node={node}
              depth={0}
              states={states}
              disabled={disabled}
              onToggle={toggleUnit}
            />
          ))
        )}
      </div>
    </div>
  );
}

function OrgNode({
  node,
  depth,
  states,
  disabled,
  onToggle,
}: {
  node: OrganizationHierarchyNodeDto;
  depth: number;
  states: Map<string, OrgUnitState>;
  disabled?: boolean;
  onToggle: (id: string) => void;
}) {
  const state = states.get(node.unit.id) ?? {
    selected: false,
    inherited: false,
    indeterminate: false,
  };
  const checkboxDisabled = disabled || state.inherited;

  return (
    <div>
      <label
        className={cn(
          "flex items-center gap-2 rounded-md px-2 py-1.5",
          checkboxDisabled ? "cursor-default" : "cursor-pointer hover:bg-muted/40"
        )}
        style={{ paddingLeft: `${depth * 16 + 8}px` }}
      >
        <Checkbox
          checked={state.indeterminate ? "indeterminate" : state.selected || state.inherited}
          disabled={checkboxDisabled}
          onCheckedChange={() => onToggle(node.unit.id)}
          aria-label={node.unit.name}
          className={cn(state.indeterminate && INDETERMINATE_DASH)}
        />
        <span
          className={cn(
            "truncate text-sm",
            state.selected || state.inherited ? "text-foreground" : "text-muted-foreground"
          )}
        >
          {node.unit.name}
        </span>
        {state.inherited ? (
          <span className="ml-auto shrink-0 text-[0.7rem] text-muted-foreground">included</span>
        ) : null}
      </label>
      {node.children.map((child) => (
        <OrgNode
          key={child.unit.id}
          node={child}
          depth={depth + 1}
          states={states}
          disabled={disabled}
          onToggle={onToggle}
        />
      ))}
    </div>
  );
}
