"use client";

import { useMemo, useState } from "react";
import { Building2, ChevronDown, ChevronRight, ChevronsUpDown, Search } from "lucide-react";
import type { OrganizationHierarchyNodeDto } from "@repo/api";
import { Button } from "@repo/ds/components/ui/button";
import { Input } from "@repo/ds/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@repo/ds/components/ui/popover";
import { Spinner } from "@repo/ds/components/ui/spinner";
import { cn } from "@repo/ds/lib/utils";
import { useOrgHierarchy } from "../../api/use-performance";

export interface PickedOrgUnit {
  id: string;
  name: string;
  /** Ancestor names, top-down, for the selected-path label. */
  path: string[];
}

interface FlatUnit {
  id: string;
  name: string;
  path: string[];
}

function flattenWithPath(
  nodes: OrganizationHierarchyNodeDto[],
  ancestors: string[],
  acc: FlatUnit[]
): FlatUnit[] {
  for (const node of nodes) {
    acc.push({ id: node.unit.id, name: node.unit.name, path: ancestors });
    flattenWithPath(node.children, [...ancestors, node.unit.name], acc);
  }
  return acc;
}

/**
 * Single-select organizational-unit picker over real Core Organization data:
 * searchable, hierarchical, expand/collapse, and it keeps the selected unit's path
 * visible. Replaces a flat indented dropdown so the org relationship stays legible.
 */
export function OrgUnitPicker({
  value,
  onChange,
  disabled,
}: {
  value: PickedOrgUnit | null;
  onChange: (unit: PickedOrgUnit) => void;
  disabled?: boolean;
}) {
  const hierarchy = useOrgHierarchy();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  const flat = useMemo(
    () => (hierarchy.data ? flattenWithPath(hierarchy.data.roots, [], []) : []),
    [hierarchy.data]
  );
  const q = query.trim().toLowerCase();
  const matches = q === "" ? [] : flat.filter((unit) => unit.name.toLowerCase().includes(q));

  function select(unit: { id: string; name: string; path: string[] }) {
    onChange({ id: unit.id, name: unit.name, path: unit.path });
    setQuery("");
    setOpen(false);
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className={cn("w-full justify-between font-normal", value && "h-auto py-2")}
        >
          {value ? (
            <span className="flex min-w-0 items-center gap-2.5">
              <span className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                <Building2 className="size-3.5" aria-hidden />
              </span>
              <span className="min-w-0 text-left">
                <span className="block truncate text-sm font-medium text-foreground">{value.name}</span>
                {value.path.length > 0 ? (
                  <span className="block truncate text-xs text-muted-foreground">
                    {value.path.join(" › ")}
                  </span>
                ) : null}
              </span>
            </span>
          ) : (
            <span className="flex items-center gap-2 text-muted-foreground">
              <Building2 className="size-3.5" aria-hidden />
              Select an organizational unit
            </span>
          )}
          <ChevronsUpDown className="size-3.5 shrink-0 opacity-50" aria-hidden />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-[var(--radix-popover-trigger-width)] p-0">
        <div className="flex items-center gap-2 border-b border-border px-3">
          <Search className="size-3.5 text-muted-foreground" aria-hidden />
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search units…"
            className="h-9 border-0 px-0 shadow-none focus-visible:ring-0"
            autoFocus
          />
          {hierarchy.isLoading ? <Spinner className="size-3.5 text-muted-foreground" /> : null}
        </div>
        <div className="max-h-72 overflow-y-auto p-1">
          {hierarchy.error ? (
            <p className="px-3 py-6 text-center text-sm text-muted-foreground">
              Organization is unavailable.
            </p>
          ) : q !== "" ? (
            matches.length === 0 ? (
              <p className="px-3 py-6 text-center text-sm text-muted-foreground">
                No units match “{query.trim()}”.
              </p>
            ) : (
              matches.map((unit) => (
                <button
                  key={unit.id}
                  type="button"
                  onClick={() => select(unit)}
                  className="flex w-full flex-col gap-0.5 rounded-md px-3 py-2 text-left hover:bg-muted focus-visible:bg-muted focus-visible:outline-none"
                >
                  <span className="truncate text-sm font-medium text-foreground">{unit.name}</span>
                  {unit.path.length > 0 ? (
                    <span className="truncate text-xs text-muted-foreground">
                      {unit.path.join(" › ")}
                    </span>
                  ) : null}
                </button>
              ))
            )
          ) : hierarchy.data ? (
            hierarchy.data.roots.map((node) => (
              <OrgTreeNode
                key={node.unit.id}
                node={node}
                depth={0}
                ancestors={[]}
                selectedId={value?.id ?? null}
                onSelect={select}
              />
            ))
          ) : null}
        </div>
      </PopoverContent>
    </Popover>
  );
}

function OrgTreeNode({
  node,
  depth,
  ancestors,
  selectedId,
  onSelect,
}: {
  node: OrganizationHierarchyNodeDto;
  depth: number;
  ancestors: string[];
  selectedId: string | null;
  onSelect: (unit: { id: string; name: string; path: string[] }) => void;
}) {
  const [expanded, setExpanded] = useState(depth < 1);
  const hasChildren = node.children.length > 0;
  const isSelected = node.unit.id === selectedId;

  return (
    <div>
      <div
        className={cn(
          "flex items-center gap-1 rounded-md",
          isSelected ? "bg-primary/10" : "hover:bg-muted"
        )}
        style={{ paddingLeft: `${depth * 14 + 4}px` }}
      >
        {hasChildren ? (
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            className="flex size-5 shrink-0 items-center justify-center rounded text-muted-foreground hover:text-foreground"
            aria-label={expanded ? "Collapse" : "Expand"}
          >
            {expanded ? <ChevronDown className="size-3.5" /> : <ChevronRight className="size-3.5" />}
          </button>
        ) : (
          <span className="size-5 shrink-0" aria-hidden />
        )}
        <button
          type="button"
          onClick={() => onSelect({ id: node.unit.id, name: node.unit.name, path: ancestors })}
          className={cn(
            "flex-1 truncate py-1.5 pr-2 text-left text-sm",
            isSelected ? "font-medium text-primary" : "text-foreground"
          )}
        >
          {node.unit.name}
        </button>
      </div>
      {expanded
        ? node.children.map((child) => (
            <OrgTreeNode
              key={child.unit.id}
              node={child}
              depth={depth + 1}
              ancestors={[...ancestors, node.unit.name]}
              selectedId={selectedId}
              onSelect={onSelect}
            />
          ))
        : null}
    </div>
  );
}
