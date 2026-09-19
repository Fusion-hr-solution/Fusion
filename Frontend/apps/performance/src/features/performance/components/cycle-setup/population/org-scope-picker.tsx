"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Building2,
  ChevronDown,
  ChevronRight,
  Network,
  Search,
  Users2,
  X,
} from "lucide-react";
import type {
  OrganizationHierarchyNodeDto,
  OrgUnitSelectionInput,
} from "@repo/api";
import { useOrgHierarchy } from "@repo/workforce-ui";
import { Checkbox } from "@repo/ds/components/ui/checkbox";
import { Switch } from "@repo/ds/components/ui/switch";
import { Input } from "@repo/ds/components/ui/input";
import { Skeleton } from "@repo/ds/components/ui/skeleton";
import { cn } from "@repo/ds/lib/utils";
import { computeOrgStates } from "./population-model";

const APPLY_DEBOUNCE_MS = 250;

/**
 * The inline organization-scope picker: a live tree on the left, the resolved selection on the
 * right. Each chosen unit independently decides whether it also pulls in its sub-units, so the
 * scope reads exactly as the server resolves it. Edits are held locally for instant tree feedback
 * and pushed to the parent on a short debounce — the parent owns the authoritative PUT and the
 * re-resolution that feeds the matched count back in.
 */
export function OrgScopePicker({
  asOf,
  selections,
  matchedCount,
  onChange,
}: {
  asOf: string;
  selections: OrgUnitSelectionInput[];
  matchedCount: number | null;
  onChange: (selections: OrgUnitSelectionInput[]) => void;
}) {
  const hierarchy = useOrgHierarchy(true, asOf);
  const roots = useMemo(() => hierarchy.data?.roots ?? [], [hierarchy.data]);

  // Local working copy for instant feedback; seeded once (this surface is remounted whenever the
  // mode toggles away and back, which re-reads the authoritative selection from props).
  const [working, setWorking] = useState<OrgUnitSelectionInput[]>(
    () => selections
  );
  const [term, setTerm] = useState("");
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latest = useRef(working);

  // Hold the latest onChange in a ref: the parent re-derives it on every resolution, and keying the
  // scheduler or the unmount flush on its identity would fire redundant PUTs on each re-render (and
  // could loop, since each PUT writes back through the cache). Both stay identity-stable instead.
  const onChangeRef = useRef(onChange);
  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  const schedule = useCallback((next: OrgUnitSelectionInput[]) => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(
      () => onChangeRef.current(next),
      APPLY_DEBOUNCE_MS
    );
  }, []);

  // Flush a pending change on true unmount only (mode switch / navigation) so nothing is lost.
  useEffect(
    () => () => {
      if (!timer.current) return;
      clearTimeout(timer.current);
      onChangeRef.current(latest.current);
    },
    []
  );

  const commit = useCallback(
    (next: OrgUnitSelectionInput[]) => {
      latest.current = next;
      setWorking(next);
      schedule(next);
    },
    [schedule]
  );

  const toggleUnit = useCallback(
    (id: string) => {
      const exists = latest.current.some((s) => s.orgUnitId === id);
      commit(
        exists
          ? latest.current.filter((s) => s.orgUnitId !== id)
          : [...latest.current, { orgUnitId: id, includeDescendants: false }]
      );
    },
    [commit]
  );

  const setIncludeDescendants = useCallback(
    (id: string, value: boolean) =>
      commit(
        latest.current.map((s) =>
          s.orgUnitId === id ? { ...s, includeDescendants: value } : s
        )
      ),
    [commit]
  );

  const states = useMemo(
    () => computeOrgStates(roots, working),
    [roots, working]
  );

  // Search visibility: a node shows when it matches, or has a matching ancestor or descendant, so
  // the surrounding hierarchy stays navigable rather than collapsing to a flat result list.
  const visibleIds = useMemo(
    () => searchVisibility(roots, term),
    [roots, term]
  );
  const searching = term.trim().length > 0;

  const names = useMemo(() => {
    const map = new Map<string, string>();
    const walk = (node: OrganizationHierarchyNodeDto) => {
      map.set(node.unit.id, node.unit.name);
      node.children.forEach(walk);
    };
    roots.forEach(walk);
    return map;
  }, [roots]);

  const selectedList = working.filter((s) => names.has(s.orgUnitId));

  function toggleCollapse(id: string) {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function renderNode(node: OrganizationHierarchyNodeDto, depth: number) {
    if (visibleIds && !visibleIds.has(node.unit.id)) return null;
    const state = states.get(node.unit.id);
    const hasChildren = node.children.length > 0;
    const isCollapsed = collapsed.has(node.unit.id) && !searching;
    const checked = state?.selected
      ? true
      : state?.inherited
        ? true
        : state?.indeterminate
          ? "indeterminate"
          : false;
    const covered = Boolean(state?.selected || state?.inherited);

    return (
      <li key={node.unit.id}>
        <div
          className={cn(
            "group flex items-center gap-2 rounded-lg py-1.5 pr-2 transition-colors",
            state?.inherited ? "opacity-70" : "hover:bg-muted/50"
          )}
          style={{ paddingLeft: `${depth * 1.25 + 0.25}rem` }}
        >
          {hasChildren ? (
            <button
              type="button"
              onClick={() => toggleCollapse(node.unit.id)}
              className="flex size-5 shrink-0 items-center justify-center rounded text-muted-foreground hover:text-foreground"
              aria-label={
                isCollapsed
                  ? `Expand ${node.unit.name}`
                  : `Collapse ${node.unit.name}`
              }
              aria-expanded={!isCollapsed}
            >
              {isCollapsed ? (
                <ChevronRight className="size-4" />
              ) : (
                <ChevronDown className="size-4" />
              )}
            </button>
          ) : (
            <span className="size-5 shrink-0" aria-hidden />
          )}

          <label
            className={cn(
              "flex min-w-0 flex-1 items-center gap-2.5",
              state?.inherited ? "cursor-default" : "cursor-pointer"
            )}
          >
            <Checkbox
              checked={checked}
              disabled={state?.inherited}
              onCheckedChange={() => toggleUnit(node.unit.id)}
              aria-label={node.unit.name}
            />
            <span
              className={cn(
                "type-body truncate",
                covered ? "text-foreground" : "text-muted-foreground"
              )}
            >
              {node.unit.name}
            </span>
          </label>

          {state?.inherited ? (
            <span className="shrink-0 type-meta text-muted-foreground">
              via parent
            </span>
          ) : state?.selected ? (
            <label className="flex shrink-0 cursor-pointer items-center gap-2 pl-2">
              <span
                className={cn(
                  "type-meta",
                  state.includeDescendants
                    ? "text-primary"
                    : "text-muted-foreground"
                )}
              >
                Include sub-units
              </span>
              <Switch
                checked={state.includeDescendants}
                onCheckedChange={(value) =>
                  setIncludeDescendants(node.unit.id, value)
                }
                aria-label={`Include sub-units of ${node.unit.name}`}
              />
            </label>
          ) : null}
        </div>

        {hasChildren && !isCollapsed ? (
          <ul>{node.children.map((child) => renderNode(child, depth + 1))}</ul>
        ) : null}
      </li>
    );
  }

  return (
    <div className="mt-4 grid gap-4 lg:grid-cols-2">
      {/* Left — the org tree */}
      <div className="flex h-[22rem] flex-col overflow-hidden rounded-xl border border-border bg-background">
        <div className="border-b border-border px-4 pb-3 pt-4">
          <p className="type-label text-foreground">Organization units</p>
          <div className="relative mt-2.5">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden
            />
            <Input
              value={term}
              onChange={(event) => setTerm(event.target.value)}
              placeholder="Search organization units..."
              className="h-9 pl-9"
            />
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-2 py-2">
          {hierarchy.isLoading ? (
            <div className="space-y-2 px-2 py-1">
              {Array.from({ length: 6 }).map((_, index) => (
                <Skeleton key={index} className="h-8 w-full" />
              ))}
            </div>
          ) : roots.length === 0 ? (
            <EmptyTree />
          ) : visibleIds && visibleIds.size === 0 ? (
            <div className="flex flex-col items-center justify-center gap-2 px-6 py-16 text-center">
              <Search className="size-5 text-muted-foreground" aria-hidden />
              <p className="type-body-secondary text-muted-foreground">
                No units match &ldquo;{term}&rdquo;.
              </p>
            </div>
          ) : (
            <ul>{roots.map((root) => renderNode(root, 0))}</ul>
          )}
        </div>
      </div>

      {/* Right — the resolved selection */}
      <div className="flex h-[22rem] flex-col rounded-xl border border-border bg-background p-4">
        <div className="flex items-baseline justify-between gap-3">
          <p className="type-label text-foreground">Selected scope</p>
          <p className="type-meta text-muted-foreground">
            {selectedList.length} organization{" "}
            {selectedList.length === 1 ? "unit" : "units"}
          </p>
        </div>

        {selectedList.length === 0 ? (
          <div className="mt-3 flex flex-1 flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-border px-6 py-10 text-center">
            <Network className="size-5 text-muted-foreground" aria-hidden />
            <div>
              <p className="type-label text-foreground">
                No organization units selected yet.
              </p>
              <p className="mt-1 type-body-secondary text-muted-foreground">
                Select one or more units to resolve the population.
              </p>
            </div>
          </div>
        ) : (
          <>
            <ul className="mt-3 min-h-0 flex-1 space-y-2 overflow-y-auto">
              {selectedList.map((selection) => (
                <li
                  key={selection.orgUnitId}
                  className="flex items-center gap-3 rounded-lg border border-border bg-card px-3 py-2.5"
                >
                  <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                    <Network className="size-4" aria-hidden />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="type-label truncate text-foreground">
                      {names.get(selection.orgUnitId) ?? "Unit"}
                    </p>
                    {selection.includeDescendants ? (
                      <p className="type-meta text-muted-foreground">
                        Includes all sub-units
                      </p>
                    ) : null}
                  </div>
                  {selection.includeDescendants ? (
                    <span className="shrink-0 rounded-md bg-primary/15 px-2 py-0.5 type-meta font-medium text-primary">
                      With sub-units
                    </span>
                  ) : null}
                  <button
                    type="button"
                    onClick={() => toggleUnit(selection.orgUnitId)}
                    className="flex size-7 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                    aria-label={`Remove ${names.get(selection.orgUnitId) ?? "unit"} from scope`}
                  >
                    <X className="size-4" />
                  </button>
                </li>
              ))}
            </ul>

            <div className="mt-4 grid grid-cols-2 gap-4 border-t border-border pt-4">
              <div>
                <p className="type-metric text-foreground tabular-nums leading-none">
                  {selectedList.length}
                </p>
                <p className="mt-1.5 type-meta text-muted-foreground">
                  Organization units selected
                </p>
              </div>
              <div>
                <p className="type-metric text-foreground tabular-nums leading-none">
                  {matchedCount === null ? "—" : matchedCount}
                </p>
                <p className="mt-1.5 flex items-center gap-1.5 type-meta text-muted-foreground">
                  <Users2 className="size-3.5" aria-hidden />
                  Matched by scope
                </p>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function EmptyTree() {
  return (
    <div className="flex flex-col items-center justify-center gap-2 px-6 py-16 text-center">
      <Building2 className="size-6 text-muted-foreground" aria-hidden />
      <p className="type-body-secondary text-muted-foreground">
        No organization units exist yet.
      </p>
    </div>
  );
}

/**
 * Returns the set of unit ids to show for the current search term (matches plus their ancestors and
 * descendants), or null when there is no term (show everything). Keeps a matched unit's surrounding
 * hierarchy visible so the result stays navigable.
 */
function searchVisibility(
  roots: OrganizationHierarchyNodeDto[],
  term: string
): Set<string> | null {
  const needle = term.trim().toLowerCase();
  if (!needle) return null;
  const visible = new Set<string>();
  const walk = (
    node: OrganizationHierarchyNodeDto,
    ancestorMatched: boolean
  ): boolean => {
    const selfMatched = node.unit.name.toLowerCase().includes(needle);
    let descendantMatched = false;
    for (const child of node.children) {
      if (walk(child, ancestorMatched || selfMatched)) descendantMatched = true;
    }
    if (selfMatched || descendantMatched || ancestorMatched)
      visible.add(node.unit.id);
    return selfMatched || descendantMatched;
  };
  for (const root of roots) walk(root, false);
  return visible;
}
