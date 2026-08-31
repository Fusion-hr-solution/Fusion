"use client";

import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { AlertCircle, Check, ChevronDown, ChevronRight, Plus, Sparkles, TriangleAlert, Unlink } from "lucide-react";
import { Badge, cn } from "@repo/ds";
import type { OrganizationImportIssueSeverity } from "@repo/api";
import { flattenReviewTree, type ReviewTreeModel, type ReviewTreeNode } from "../model/import-review-model";

export interface ImportReviewOutlineProps {
  model: ReviewTreeModel;
  collapsed: ReadonlySet<string>;
  selectedId: string | null;
  highlightedIds: ReadonlySet<string>;
  attention: Map<string, OrganizationImportIssueSeverity>;
  /** How units still being interpreted by AI should read in the Status column. */
  interpretation?: "interpreting" | "suggested" | null;
  interpretationIds?: ReadonlySet<string>;
  onSelect: (id: string) => void;
  onToggle: (id: string) => void;
}

const GRID_WITH_STATUS = "grid-cols-[minmax(220px,1fr)_150px_140px_150px]";
const GRID_NO_STATUS = "grid-cols-[minmax(240px,1fr)_170px_160px]";

export function ImportReviewOutline({
  model,
  collapsed,
  selectedId,
  highlightedIds,
  attention,
  interpretation = null,
  interpretationIds,
  onSelect,
  onToggle,
}: ImportReviewOutlineProps) {
  const rows = useMemo(() => flattenReviewTree(model, collapsed), [collapsed, model]);
  const [activeId, setActiveId] = useState(selectedId ?? rows[0]?.node.id ?? null);
  const rowRefs = useRef(new Map<string, HTMLDivElement>());

  // "New" only carries information when the import mixes new and existing units. For an all-new
  // import it is the uniform baseline — the bold name weight already conveys it — so it stays quiet
  // and the Status column disappears entirely, letting the resulting structure read on its own.
  const distinguishNew = useMemo(() => {
    let anyNew = false;
    let anyExisting = false;
    for (const node of model.byId.values()) {
      if (node.isPlaceholder) continue;
      if (node.isNew) anyNew = true;
      else anyExisting = true;
    }
    return anyNew && anyExisting;
  }, [model]);

  const statusKind = (
    node: ReviewTreeNode
  ): "interpreting" | "attention" | "review" | "matched" | "new" | null => {
    if (interpretation && !node.isPlaceholder && interpretationIds?.has(node.id))
      return "interpreting";
    const severity = attention.get(node.id);
    if (severity === "Blocker") return "attention";
    if (severity === "Warning") return "review";
    if (node.isPlaceholder) return null;
    if (!node.isNew) return distinguishNew ? "matched" : null;
    return distinguishNew ? "new" : null;
  };

  // The Status column earns its place only when at least one row carries real signal — an
  // exception, an interpretation, or a new/matched distinction worth drawing. Otherwise it is
  // dropped and the remaining columns breathe.
  const showStatus = useMemo(
    () => rows.some((row) => statusKind(row.node) !== null),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [rows, attention, interpretation, interpretationIds, distinguishNew]
  );
  const gridClass = showStatus ? GRID_WITH_STATUS : GRID_NO_STATUS;

  useEffect(() => {
    if (selectedId) setActiveId(selectedId);
  }, [selectedId]);

  useEffect(() => {
    if (selectedId) rowRefs.current.get(selectedId)?.scrollIntoView({ block: "nearest" });
  }, [selectedId]);

  function focusAt(index: number) {
    const row = rows[Math.max(0, Math.min(rows.length - 1, index))];
    if (!row) return;
    setActiveId(row.node.id);
    rowRefs.current.get(row.node.id)?.focus();
  }

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>, index: number) {
    const row = rows[index];
    if (!row) return;
    if (event.key === "ArrowDown") {
      event.preventDefault();
      focusAt(index + 1);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      focusAt(index - 1);
    } else if (event.key === "Home") {
      event.preventDefault();
      focusAt(0);
    } else if (event.key === "End") {
      event.preventDefault();
      focusAt(rows.length - 1);
    } else if (event.key === "ArrowRight") {
      event.preventDefault();
      if (row.hasChildren && !row.expanded) onToggle(row.node.id);
      else if (row.hasChildren) focusAt(index + 1);
    } else if (event.key === "ArrowLeft") {
      event.preventDefault();
      if (row.hasChildren && row.expanded) onToggle(row.node.id);
      else if (row.node.parentId) {
        const parentIndex = rows.findIndex((candidate) => candidate.node.id === row.node.parentId);
        if (parentIndex >= 0) focusAt(parentIndex);
      }
    } else if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      onSelect(row.node.id);
    }
  }

  return (
    <div
      role="treegrid"
      aria-label="Resulting organization"
      aria-rowcount={rows.length}
      className="h-full min-h-[420px] overflow-auto"
    >
      <div
        role="row"
        className={cn(
          "sticky top-0 z-10 grid border-b bg-muted/60 px-4 py-2 text-xs font-medium text-muted-foreground backdrop-blur-sm",
          gridClass
        )}
      >
        <span role="columnheader">Organizational unit</span>
        <span role="columnheader">Type</span>
        <span role="columnheader">Business code</span>
        {showStatus ? <span role="columnheader">Status</span> : null}
      </div>
      {rows.map((row, index) => {
        const { node } = row;
        const selected = node.id === selectedId;
        const highlighted = highlightedIds.has(node.id) && !selected;
        const kind = statusKind(node);
        return (
          <div
            key={node.id}
            ref={(element) => {
              if (element) rowRefs.current.set(node.id, element);
              else rowRefs.current.delete(node.id);
            }}
            role="row"
            aria-level={row.depth + 1}
            aria-expanded={row.hasChildren ? row.expanded : undefined}
            aria-selected={selected}
            tabIndex={activeId === node.id ? 0 : -1}
            onFocus={() => setActiveId(node.id)}
            onKeyDown={(event) => handleKeyDown(event, index)}
            onClick={() => onSelect(node.id)}
            className={cn(
              "group grid min-h-11 cursor-pointer items-center border-b border-border/60 px-4 text-sm outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring",
              gridClass,
              selected
                ? "bg-primary/[0.08]"
                : highlighted
                  ? "bg-primary/[0.04]"
                  : "hover:bg-muted/40",
              node.isPlaceholder && "bg-warning/[0.04]"
            )}
          >
            <div
              role="gridcell"
              className="flex min-w-0 items-center"
              style={{ paddingInlineStart: `${row.depth * 22}px` }}
            >
              {row.hasChildren ? (
                <button
                  type="button"
                  aria-label={`${row.expanded ? "Collapse" : "Expand"} ${node.name}`}
                  onClick={(event) => {
                    event.stopPropagation();
                    onToggle(node.id);
                  }}
                  className="mr-1 grid h-6 w-6 shrink-0 place-items-center rounded-md text-muted-foreground outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring"
                >
                  {row.expanded ? (
                    <ChevronDown className="h-4 w-4" />
                  ) : (
                    <ChevronRight className="h-4 w-4" />
                  )}
                </button>
              ) : (
                <span className="mr-1 h-6 w-6 shrink-0" />
              )}
              {node.isPlaceholder ? (
                <span className="grid h-5 w-5 shrink-0 place-items-center rounded-md border border-dashed border-warning/60 text-warning">
                  {node.placeholderKind === "unplaced" ? (
                    <Unlink className="h-3 w-3" />
                  ) : (
                    <Plus className="h-3 w-3" />
                  )}
                </span>
              ) : null}
              <span
                className={cn(
                  "ml-1 min-w-0 truncate text-left",
                  node.isPlaceholder
                    ? "text-warning"
                    : node.isNew
                      ? "font-medium text-foreground"
                      : "text-muted-foreground"
                )}
              >
                {node.name}
              </span>
            </div>
            <span role="gridcell" className="truncate text-muted-foreground">
              {node.typeName}
            </span>
            <span role="gridcell" className="truncate font-mono text-xs text-muted-foreground">
              {node.businessCode || (node.isPlaceholder ? "—" : "")}
            </span>
            {showStatus ? (
              <span role="gridcell" className="min-w-0">
                {kind === "interpreting" ? (
                  <span
                    className={cn(
                      "inline-flex items-center gap-1 text-xs font-medium text-primary",
                      interpretation === "interpreting" && "text-primary/80"
                    )}
                  >
                    <Sparkles
                      className={cn(
                        "h-3.5 w-3.5 shrink-0",
                        interpretation === "interpreting" && "animate-pulse motion-reduce:animate-none"
                      )}
                    />
                    {interpretation === "interpreting" ? "Interpreting" : "Suggested"}
                  </span>
                ) : kind === "attention" ? (
                  <span className="inline-flex items-center gap-1 text-xs font-medium text-destructive">
                    <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                    Needs attention
                  </span>
                ) : kind === "review" ? (
                  <span className="inline-flex items-center gap-1 text-xs font-medium text-warning">
                    <TriangleAlert className="h-3.5 w-3.5 shrink-0" />
                    Review
                  </span>
                ) : kind === "matched" ? (
                  <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                    <Check className="h-3.5 w-3.5 shrink-0" />
                    Matched
                  </span>
                ) : kind === "new" ? (
                  <Badge
                    variant="outline"
                    className="border-primary bg-primary text-[10px] text-white dark:text-background"
                  >
                    New
                  </Badge>
                ) : null}
              </span>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
