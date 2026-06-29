"use client";

import { useEffect, useState } from "react";
import {
  AlertTriangle,
  Building2,
  ChevronDown,
  ChevronRight,
  Download,
  FolderTree,
  Plus,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import type { DraftStructureTreeNodeModel } from "./draft-structure-tree-utils";
import { countDraftTreeNodes } from "./draft-structure-tree-utils";

interface DraftStructureTreeProps {
  embedded?: boolean;
  nodes: DraftStructureTreeNodeModel[];
  selectedId: string | null;
  onSelect: (node: DraftStructureTreeNodeModel) => void;
  emptyTitle: string;
  emptyDescription: string;
  readOnly?: boolean;
  onDownloadCsv?: () => void;
  isDownloadDisabled?: boolean;
  onAddRoot?: () => void;
  onAddChild?: (node: DraftStructureTreeNodeModel) => void;
}

export function DraftStructureTree({
  embedded = false,
  nodes,
  selectedId,
  onSelect,
  emptyTitle,
  emptyDescription,
  readOnly = false,
  onDownloadCsv,
  isDownloadDisabled = false,
  onAddRoot,
  onAddChild,
}: DraftStructureTreeProps) {
  const [collapsedIds, setCollapsedIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    setCollapsedIds(new Set());
  }, [nodes]);

  const totalNodeCount = countDraftTreeNodes(nodes);

  const toggleNode = (id: string) => {
    setCollapsedIds((current) => {
      const next = new Set(current);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  return (
    <div
      className={cn(
        "flex h-full min-h-0 flex-col overflow-hidden",
        embedded ? "bg-transparent" : "rounded-2xl border bg-card"
      )}
    >
      {!embedded ? (
        <div className="border-b bg-muted/10 p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                Structure
              </p>
              <div className="mt-2 flex items-center gap-3">
                <div className="flex size-9 items-center justify-center rounded-lg border bg-background text-muted-foreground">
                  <Building2 className="size-4" />
                </div>
                <div>
                  <p className="text-sm font-medium">Organization root</p>
                  <p className="text-xs text-muted-foreground">
                    Top-level branches start here
                  </p>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              {onDownloadCsv ? (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={onDownloadCsv}
                  disabled={isDownloadDisabled}
                >
                  <Download className="size-4" />
                  Download CSV
                </Button>
              ) : null}

              {!readOnly && onAddRoot ? (
                <Button type="button" size="sm" onClick={onAddRoot}>
                  <Plus className="size-4" />
                  Add top-level unit
                </Button>
              ) : null}
            </div>
          </div>

          <p className="mt-3 text-sm text-muted-foreground">
            {totalNodeCount === 0
              ? emptyDescription
              : `${totalNodeCount} units are currently planned beneath the organization root.`}
          </p>
        </div>
      ) : null}

      {nodes.length === 0 ? (
        <div
          className={cn(
            "flex flex-1 flex-col items-center justify-center gap-3 text-center",
            embedded
              ? "m-6 rounded-2xl border border-dashed bg-muted/10 p-10"
              : "m-4 rounded-2xl border border-dashed bg-muted/10 p-8"
          )}
        >
          <div className="flex size-12 items-center justify-center rounded-full border bg-background text-muted-foreground">
            <FolderTree className="size-5" />
          </div>
          <div className="space-y-1">
            <p className="font-medium">{emptyTitle}</p>
            <p className="max-w-md text-sm text-muted-foreground">
              {emptyDescription}
            </p>
          </div>
        </div>
      ) : (
        <ScrollArea className="min-h-0 flex-1 p-4">
          <ul className="space-y-1">
            {nodes.map((node) => (
              <TreeBranch
                key={node.id}
                node={node}
                selectedId={selectedId}
                collapsedIds={collapsedIds}
                onSelect={onSelect}
                onToggle={toggleNode}
                readOnly={readOnly}
                onAddChild={onAddChild}
              />
            ))}
          </ul>
        </ScrollArea>
      )}
    </div>
  );
}

function TreeBranch({
  node,
  selectedId,
  collapsedIds,
  onSelect,
  onToggle,
  readOnly,
  onAddChild,
}: {
  node: DraftStructureTreeNodeModel;
  selectedId: string | null;
  collapsedIds: Set<string>;
  onSelect: (node: DraftStructureTreeNodeModel) => void;
  onToggle: (id: string) => void;
  readOnly: boolean;
  onAddChild?: (node: DraftStructureTreeNodeModel) => void;
}) {
  const hasChildren = node.children.length > 0;
  const isCollapsed = collapsedIds.has(node.id);
  const isSelected = selectedId === node.id;

  return (
    <li>
      <div
        className={cn(
          "group/tree-row rounded-2xl border border-transparent bg-background/80 transition-colors",
          isSelected
            ? "border-l-2 border-l-primary/70 bg-primary/5"
            : "hover:border-border/60 hover:bg-muted/15"
        )}
      >
        <div
          className="flex items-start gap-2 p-3"
          style={{ paddingLeft: `${node.level * 20 + 12}px` }}
        >
          {hasChildren ? (
            <Button
              type="button"
              variant="ghost"
              size="icon-xs"
              className="mt-0.5"
              onClick={() => onToggle(node.id)}
            >
              {isCollapsed ? (
                <ChevronRight className="size-3.5" />
              ) : (
                <ChevronDown className="size-3.5" />
              )}
              <span className="sr-only">Toggle children</span>
            </Button>
          ) : (
            <span className="mt-0.5 block size-6 shrink-0" />
          )}

          <button
            type="button"
            className="min-w-0 flex-1 text-left"
            onClick={() => onSelect(node)}
          >
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-medium text-foreground">
                {node.displayName}
              </span>
              <Badge variant="secondary">{node.orgUnitKindLabel}</Badge>
              {node.isOrphaned ? (
                <Badge variant="outline">Missing parent</Badge>
              ) : null}
              {node.issueSummary.errorCount > 0 ? (
                <Badge variant="destructive">
                  <AlertTriangle className="size-3" />
                  {node.issueSummary.errorCount} error
                  {node.issueSummary.errorCount === 1 ? "" : "s"}
                </Badge>
              ) : null}
              {node.issueSummary.warningCount > 0 ? (
                <Badge variant="outline">
                  {node.issueSummary.warningCount} warning
                  {node.issueSummary.warningCount === 1 ? "" : "s"}
                </Badge>
              ) : null}
            </div>

            <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              <span className="font-mono uppercase tracking-wide">
                {node.referenceKey}
              </span>
              {node.location ? <span>Location {node.location}</span> : null}
              {node.rowNumber ? <span>Row {node.rowNumber}</span> : null}
            </div>
          </button>

          {!readOnly && onAddChild ? (
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              className="opacity-100 transition-opacity md:opacity-0 md:group-hover/tree-row:opacity-100"
              onClick={() => onAddChild(node)}
            >
              <Plus className="size-4" />
              <span className="sr-only">Add child unit</span>
            </Button>
          ) : null}
        </div>
      </div>

      {hasChildren && !isCollapsed ? (
        <ul className="space-y-1 pt-1">
          {node.children.map((child) => (
            <TreeBranch
              key={child.id}
              node={child}
              selectedId={selectedId}
              collapsedIds={collapsedIds}
              onSelect={onSelect}
              onToggle={onToggle}
              readOnly={readOnly}
              onAddChild={onAddChild}
            />
          ))}
        </ul>
      ) : null}
    </li>
  );
}
