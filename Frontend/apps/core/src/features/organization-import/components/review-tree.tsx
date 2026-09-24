"use client";

import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { AlertCircle, ChevronDown, ChevronRight, Plus, TriangleAlert, Unlink } from "lucide-react";
import { cn } from "@repo/ds";
import type { OrganizationImportIssueSeverity } from "@repo/api";
import { flattenReviewTree, type ReviewTreeModel, type ReviewVisibleRow } from "../model/import-review-model";
import { ReviewTypeIcon } from "./review-type-icon";

const INDENT = 26;

/**
 * The organization Fusion intends to establish, as a read-only hierarchy. Each row carries its
 * type (icon and label) and business code; attention marks point at the Review checks. Rows are
 * selectable, never editable.
 */
export function ReviewTree({
  model,
  collapsed,
  visible,
  selectedId,
  highlightedIds,
  revealId,
  attention,
  markExisting,
  onSelect,
  onToggle,
}: {
  model: ReviewTreeModel;
  collapsed: ReadonlySet<string>;
  /** A search result: only these ids show, with their branches open. */
  visible?: ReadonlySet<string>;
  selectedId: string | null;
  highlightedIds: ReadonlySet<string>;
  /** Scrolls this row into view when it changes. */
  revealId: string | null;
  attention: Map<string, OrganizationImportIssueSeverity>;
  /** Label units that already exist, when the import mixes new and existing units. */
  markExisting: boolean;
  onSelect: (id: string) => void;
  onToggle: (id: string) => void;
}) {
  const rows = useMemo(() => flattenReviewTree(model, collapsed, visible), [model, collapsed, visible]);
  const [activeId, setActiveId] = useState<string | null>(selectedId ?? rows[0]?.node.id ?? null);
  const rowRefs = useRef(new Map<string, HTMLDivElement>());

  useEffect(() => {
    if (!revealId) return;
    setActiveId(revealId);
    rowRefs.current.get(revealId)?.scrollIntoView({ block: "center", behavior: "smooth" });
  }, [revealId]);

  const focusable = rows.some((row) => row.node.id === activeId) ? activeId : (rows[0]?.node.id ?? null);

  function move(id: string | undefined) {
    if (!id) return;
    setActiveId(id);
    rowRefs.current.get(id)?.focus();
  }

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>, row: ReviewVisibleRow, index: number) {
    const id = row.node.id;
    switch (event.key) {
      case "ArrowDown":
        event.preventDefault();
        move(rows[index + 1]?.node.id);
        break;
      case "ArrowUp":
        event.preventDefault();
        move(rows[index - 1]?.node.id);
        break;
      case "ArrowRight":
        event.preventDefault();
        if (row.hasChildren && !row.expanded) onToggle(id);
        else if (row.hasChildren) move(rows[index + 1]?.node.id);
        break;
      case "ArrowLeft": {
        event.preventDefault();
        if (row.hasChildren && row.expanded && !visible) onToggle(id);
        else move(model.parentById.get(id) ?? undefined);
        break;
      }
      case "Home":
        event.preventDefault();
        move(rows[0]?.node.id);
        break;
      case "End":
        event.preventDefault();
        move(rows.at(-1)?.node.id);
        break;
      case "Enter":
      case " ":
        event.preventDefault();
        onSelect(id);
        break;
    }
  }

  if (rows.length === 0)
    return <p className="px-2 py-10 text-center type-body text-muted-foreground">No units match your search.</p>;

  return (
    <div role="tree" aria-label="Resulting organization" className="py-1">
      {rows.map((row, index) => {
        const { node, depth } = row;
        const severity = attention.get(node.id);
        const selected = node.id === selectedId;
        const highlighted = highlightedIds.has(node.id);
        return (
          <div
            key={node.id}
            ref={(element) => {
              if (element) rowRefs.current.set(node.id, element);
              else rowRefs.current.delete(node.id);
            }}
            role="treeitem"
            aria-level={depth + 1}
            aria-expanded={row.hasChildren ? row.expanded : undefined}
            aria-selected={selected}
            tabIndex={node.id === focusable ? 0 : -1}
            onFocus={() => setActiveId(node.id)}
            onClick={() => onSelect(node.id)}
            onKeyDown={(event) => onKeyDown(event, row, index)}
            className={cn(
              "group relative flex cursor-default items-center rounded-object py-1.5 pr-3 outline-none transition-colors",
              "hover:bg-muted/50 focus-visible:ring-2 focus-visible:ring-ring",
              highlighted && "bg-warning-subtle",
              selected && "bg-primary/10 ring-1 ring-primary/30"
            )}
            style={{ paddingLeft: depth * INDENT + 4 }}
          >
            <Guides depth={depth} />
            <span className="grid size-6 shrink-0 place-items-center">
              {row.hasChildren ? (
                <button
                  type="button"
                  tabIndex={-1}
                  aria-label={`${row.expanded ? "Collapse" : "Expand"} ${node.name}`}
                  disabled={Boolean(visible)}
                  onClick={(event) => {
                    event.stopPropagation();
                    onToggle(node.id);
                  }}
                  className="grid size-6 place-items-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground disabled:hover:bg-transparent"
                >
                  {row.expanded ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" />}
                </button>
              ) : null}
            </span>
            <span
              aria-hidden
              className={cn(
                "mx-2 grid size-8 shrink-0 place-items-center rounded-lg",
                node.isPlaceholder ? "border border-dashed border-warning text-warning" : "bg-muted text-foreground/80"
              )}
            >
              {node.placeholderKind === "unplaced" ? (
                <Unlink className="size-4" />
              ) : node.placeholderKind === "root" ? (
                <Plus className="size-4" />
              ) : (
                <ReviewTypeIcon typeName={node.typeName} />
              )}
            </span>
            <span className="min-w-0 flex-1">
              <span className="flex items-center gap-1.5">
                <span
                  className={cn(
                    "truncate type-body font-medium",
                    node.isPlaceholder ? "italic text-muted-foreground" : "text-foreground"
                  )}
                >
                  {node.name}
                </span>
                {severity === "Blocker" ? (
                  <AlertCircle className="size-4 shrink-0 text-destructive" aria-label="Blocking issue" />
                ) : severity === "Warning" ? (
                  <TriangleAlert className="size-4 shrink-0 fill-warning/15 text-warning" aria-label="Warning" />
                ) : null}
                {markExisting && !node.isNew && !node.isPlaceholder ? (
                  <span className="shrink-0 rounded-md bg-muted px-1.5 py-0.5 type-meta text-muted-foreground">Existing</span>
                ) : null}
              </span>
              {!node.isPlaceholder ? (
                <span className="block truncate type-meta text-muted-foreground">
                  {[node.typeName, node.businessCode].filter(Boolean).join(" • ")}
                </span>
              ) : null}
            </span>
          </div>
        );
      })}
    </div>
  );
}

/** Quiet connector lines: one vertical per ancestor level and an elbow into the row. */
function Guides({ depth }: { depth: number }) {
  if (depth === 0) return null;
  return (
    <span aria-hidden className="pointer-events-none absolute inset-y-0 left-0">
      {Array.from({ length: depth }, (_, level) => (
        <span
          key={level}
          className="absolute inset-y-0 border-l border-border"
          style={{ left: level * INDENT + 4 + 11 }}
        />
      ))}
      <span
        className="absolute top-1/2 w-3 border-t border-border"
        style={{ left: (depth - 1) * INDENT + 4 + 11 }}
      />
    </span>
  );
}
