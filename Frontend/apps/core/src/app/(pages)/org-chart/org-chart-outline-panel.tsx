"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { ChevronRight, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export interface OutlineNode {
  id: string;
  label: string;
  sublabel?: string | null;
  children: OutlineNode[];
}

interface FlatRow {
  id: string;
  label: string;
  sublabel?: string | null;
  depth: number;
  hasChildren: boolean;
  expanded: boolean;
  parentId: string | null;
}

interface OrgChartOutlinePanelProps {
  title: string;
  roots: OutlineNode[];
  selectedId: string | null;
  collapsedIds: Set<string>;
  onSelect: (id: string) => void;
  onToggleCollapse: (id: string) => void;
  onClose: () => void;
}

function flattenVisible(
  roots: OutlineNode[],
  collapsedIds: Set<string>
): FlatRow[] {
  const rows: FlatRow[] = [];
  const visit = (node: OutlineNode, depth: number, parentId: string | null) => {
    const hasChildren = node.children.length > 0;
    const expanded = hasChildren && !collapsedIds.has(node.id);
    rows.push({
      id: node.id,
      label: node.label,
      sublabel: node.sublabel,
      depth,
      hasChildren,
      expanded,
      parentId,
    });
    if (expanded) {
      node.children.forEach((child) => visit(child, depth + 1, node.id));
    }
  };
  roots.forEach((root) => visit(root, 0, null));
  return rows;
}

export function OrgChartOutlinePanel({
  title,
  roots,
  selectedId,
  collapsedIds,
  onSelect,
  onToggleCollapse,
  onClose,
}: OrgChartOutlinePanelProps) {
  const rows = useMemo(
    () => flattenVisible(roots, collapsedIds),
    [collapsedIds, roots]
  );
  const [activeId, setActiveId] = useState<string | null>(
    selectedId ?? rows[0]?.id ?? null
  );
  const containerRef = useRef<HTMLDivElement>(null);

  // Keep the active (roving-tabindex) row in sync with the canvas selection.
  useEffect(() => {
    if (selectedId) setActiveId(selectedId);
  }, [selectedId]);

  // Ensure the active row still exists after the visible set changes.
  useEffect(() => {
    if (activeId && !rows.some((row) => row.id === activeId)) {
      setActiveId(rows[0]?.id ?? null);
    }
  }, [activeId, rows]);

  const moveActive = useCallback(
    (id: string) => {
      setActiveId(id);
      const el = containerRef.current?.querySelector<HTMLElement>(
        `[data-row-id="${CSS.escape(id)}"]`
      );
      el?.focus();
      el?.scrollIntoView({ block: "nearest" });
    },
    []
  );

  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent, row: FlatRow) => {
      const index = rows.findIndex((r) => r.id === row.id);
      switch (event.key) {
        case "ArrowDown": {
          event.preventDefault();
          const next = rows[index + 1];
          if (next) moveActive(next.id);
          break;
        }
        case "ArrowUp": {
          event.preventDefault();
          const prev = rows[index - 1];
          if (prev) moveActive(prev.id);
          break;
        }
        case "ArrowRight": {
          event.preventDefault();
          if (row.hasChildren && !row.expanded) {
            onToggleCollapse(row.id);
          } else if (row.hasChildren && row.expanded) {
            const next = rows[index + 1];
            if (next && next.parentId === row.id) moveActive(next.id);
          }
          break;
        }
        case "ArrowLeft": {
          event.preventDefault();
          if (row.hasChildren && row.expanded) {
            onToggleCollapse(row.id);
          } else if (row.parentId) {
            moveActive(row.parentId);
          }
          break;
        }
        case "Enter":
        case " ": {
          event.preventDefault();
          onSelect(row.id);
          break;
        }
        default:
          break;
      }
    },
    [moveActive, onSelect, onToggleCollapse, rows]
  );

  return (
    <div className="flex h-full w-72 shrink-0 flex-col border-r bg-card">
      <div className="flex shrink-0 items-center justify-between gap-2 border-b px-3 py-2.5">
        <p className="text-sm font-medium">{title}</p>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label="Close outline"
          onClick={onClose}
        >
          <X className="size-4" />
        </Button>
      </div>

      <div
        ref={containerRef}
        role="tree"
        aria-label={title}
        className="min-h-0 flex-1 overflow-y-auto p-1.5"
      >
        {rows.length === 0 ? (
          <p className="px-2 py-3 text-xs text-muted-foreground">
            Nothing to show.
          </p>
        ) : (
          rows.map((row) => {
            const isSelected = row.id === selectedId;
            const isActive = row.id === activeId;
            return (
              <div
                key={row.id}
                role="treeitem"
                data-row-id={row.id}
                aria-level={row.depth + 1}
                aria-selected={isSelected}
                aria-expanded={row.hasChildren ? row.expanded : undefined}
                tabIndex={isActive ? 0 : -1}
                onKeyDown={(event) => handleKeyDown(event, row)}
                onClick={() => {
                  setActiveId(row.id);
                  onSelect(row.id);
                }}
                className={cn(
                  "flex cursor-pointer items-center gap-1 rounded-md py-1.5 pr-2 text-sm outline-none transition-colors",
                  "hover:bg-muted focus-visible:ring-2 focus-visible:ring-primary/50",
                  isSelected && "bg-primary/10 text-foreground"
                )}
                style={{ paddingLeft: `${row.depth * 14 + 6}px` }}
              >
                {row.hasChildren ? (
                  <button
                    type="button"
                    tabIndex={-1}
                    aria-label={row.expanded ? "Collapse" : "Expand"}
                    className="flex size-4 shrink-0 items-center justify-center rounded text-muted-foreground hover:text-foreground"
                    onClick={(event) => {
                      event.stopPropagation();
                      onToggleCollapse(row.id);
                    }}
                  >
                    <ChevronRight
                      className={cn(
                        "size-3.5 transition-transform",
                        row.expanded && "rotate-90"
                      )}
                    />
                  </button>
                ) : (
                  <span className="size-4 shrink-0" />
                )}
                <span className="min-w-0 flex-1">
                  <span className="block truncate leading-tight">
                    {row.label}
                  </span>
                  {row.sublabel ? (
                    <span className="block truncate text-xs text-muted-foreground">
                      {row.sublabel}
                    </span>
                  ) : null}
                </span>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
