"use client";

import { useMemo } from "react";
import { Building2, Search, SlidersHorizontal, Target, X } from "lucide-react";
import type { GoalNodeDto, GoalsOverviewDto, ObjectiveLifecycleState } from "@repo/api";
import { Avatar, AvatarFallback } from "@repo/ds/components/ui/avatar";
import { Button } from "@repo/ds/components/ui/button";
import { Input } from "@repo/ds/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@repo/ds/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@repo/ds/components/ui/select";
import { ToggleGroup, ToggleGroupItem } from "@repo/ds/components/ui/toggle-group";
import { StatusBadge } from "@repo/ds/shell";
import { cn } from "@repo/ds/lib/utils";
import { initials, scopeLabel, STATE_LABEL, STATE_TONE } from "./goals-lib";

export type StatusFilter = "all" | ObjectiveLifecycleState;

export interface GoalsFilterState {
  query: string;
  status: StatusFilter;
  scope: string | null;
}

export const EMPTY_FILTER: GoalsFilterState = { query: "", status: "all", scope: null };

export function isFilterActive(filter: GoalsFilterState): boolean {
  return filter.query.trim() !== "" || filter.status !== "all" || filter.scope !== null;
}

/** The org units that actually own an objective — the only truthful scope options to filter by. */
function orgScopes(overview: GoalsOverviewDto): string[] {
  const names = new Set<string>();
  for (const node of overview.nodes) {
    if (node.ownershipScope === "OrgUnit" && node.orgUnitName) names.add(node.orgUnitName);
  }
  return [...names].sort((a, b) => a.localeCompare(b));
}

/**
 * The cascade's focus/search control. Filtering is secondary utility — it narrows a non-trivial
 * cascade by lifecycle state, owning unit, or free text; it never invents "attention" or health.
 */
export function GoalsFilter({
  overview,
  value,
  onChange,
}: {
  overview: GoalsOverviewDto;
  value: GoalsFilterState;
  onChange: (next: GoalsFilterState) => void;
}) {
  const scopes = useMemo(() => orgScopes(overview), [overview]);
  const active = isFilterActive(value);

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className={cn(active && "border-primary/50 text-foreground")}>
          <SlidersHorizontal className="size-4" data-icon="inline-start" />
          Filter
          {active ? <span className="ml-0.5 size-1.5 rounded-full bg-primary" aria-hidden /> : null}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 space-y-4">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <Input
            value={value.query}
            onChange={(event) => onChange({ ...value, query: event.target.value })}
            placeholder="Search objectives"
            className="pl-9"
          />
        </div>

        <div className="space-y-1.5">
          <p className="type-eyebrow text-muted-foreground">Status</p>
          <ToggleGroup
            type="single"
            value={value.status}
            onValueChange={(next) => onChange({ ...value, status: (next || "all") as StatusFilter })}
            className="justify-start gap-1"
          >
            <ToggleGroupItem value="all" className="px-3">All</ToggleGroupItem>
            <ToggleGroupItem value="Draft" className="px-3">Draft</ToggleGroupItem>
            <ToggleGroupItem value="Published" className="px-3">Published</ToggleGroupItem>
          </ToggleGroup>
        </div>

        {scopes.length > 0 ? (
          <div className="space-y-1.5">
            <p className="type-eyebrow text-muted-foreground">Organizational unit</p>
            <Select
              value={value.scope ?? "all"}
              onValueChange={(next) => onChange({ ...value, scope: next === "all" ? null : next })}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="All units" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All units</SelectItem>
                {scopes.map((name) => (
                  <SelectItem key={name} value={name}>
                    {name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        ) : null}

        {active ? (
          <Button variant="ghost" size="sm" className="w-full" onClick={() => onChange(EMPTY_FILTER)}>
            <X className="size-4" data-icon="inline-start" /> Clear filters
          </Button>
        ) : null}
      </PopoverContent>
    </Popover>
  );
}

/**
 * Flat, filtered results — the folded-in utility of the retired List view. Shown only while a
 * filter is engaged; clearing returns the workspace to the hierarchical cascade.
 */
export function FilteredObjectives({
  overview,
  filter,
  onInspect,
  onClear,
}: {
  overview: GoalsOverviewDto;
  filter: GoalsFilterState;
  onInspect: (id: string) => void;
  onClear: () => void;
}) {
  const rows = useMemo(() => {
    const term = filter.query.trim().toLowerCase();
    return overview.nodes
      .filter((node) => {
        if (filter.status !== "all") return node.ownershipScope === "OrgUnit" && node.state === filter.status;
        return true;
      })
      .filter((node) => (filter.scope ? node.orgUnitName === filter.scope : true))
      .filter(
        (node) =>
          term === "" ||
          node.title.toLowerCase().includes(term) ||
          (node.accountablePersonName ?? "").toLowerCase().includes(term) ||
          scopeLabel(node).toLowerCase().includes(term)
      )
      .sort((a, b) => a.ownershipScope.localeCompare(b.ownershipScope) || a.title.localeCompare(b.title));
  }, [overview.nodes, filter]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          {rows.length} {rows.length === 1 ? "objective" : "objectives"} match
        </p>
        <Button variant="ghost" size="sm" onClick={onClear}>
          <X className="size-4" data-icon="inline-start" /> Clear
        </Button>
      </div>

      {rows.length === 0 ? (
        <div className="rounded-2xl border border-dashed p-10 text-center text-sm text-muted-foreground">
          No objectives match these filters.
        </div>
      ) : (
        <div className="divide-y overflow-hidden rounded-2xl border">
          {rows.map((node) => (
            <ResultRow key={node.id} node={node} onInspect={onInspect} />
          ))}
        </div>
      )}
    </div>
  );
}

function ResultRow({ node, onInspect }: { node: GoalNodeDto; onInspect: (id: string) => void }) {
  const Icon = node.ownershipScope === "Company" ? Target : Building2;
  return (
    <button
      type="button"
      onClick={() => onInspect(node.id)}
      className="flex w-full items-center gap-4 px-4 py-3 text-left transition-colors hover:bg-muted/40"
    >
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{node.title}</p>
        <p className="mt-0.5 flex items-center gap-1.5 truncate text-xs text-muted-foreground">
          <Icon className="size-3.5 shrink-0" aria-hidden /> {scopeLabel(node)}
          <span className="text-muted-foreground/50">·</span> {node.measurementSummary}
        </p>
      </div>
      <div className="hidden items-center gap-2 sm:flex">
        <Avatar className="size-6">
          <AvatarFallback className="text-[10px]">{initials(node.accountablePersonName)}</AvatarFallback>
        </Avatar>
        <span className="max-w-40 truncate text-sm text-muted-foreground">{node.accountablePersonName ?? "—"}</span>
      </div>
      <StatusBadge tone={STATE_TONE[node.state]} dot>
        {STATE_LABEL[node.state]}
      </StatusBadge>
    </button>
  );
}
