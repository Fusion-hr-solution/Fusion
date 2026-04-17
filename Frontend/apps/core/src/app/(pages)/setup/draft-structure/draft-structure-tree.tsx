"use client";

import { useEffect, useState } from "react";
import {
  AlertTriangle,
  Building2,
  ChevronDown,
  ChevronRight,
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
  nodes: DraftStructureTreeNodeModel[];
  selectedId: string | null;
  onSelect: (node: DraftStructureTreeNodeModel) => void;
  emptyTitle: string;
  emptyDescription: string;
  readOnly?: boolean;
  onAddRoot?: () => void;
  onAddChild?: (node: DraftStructureTreeNodeModel) => void;
}

export function DraftStructureTree({
  nodes,
  selectedId,
  onSelect,
  emptyTitle,
  emptyDescription,
  readOnly = false,
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
    <div className="flex h-full min-h-128 flex-col overflow-hidden rounded-2xl border bg-card">
      <div className="border-b p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
              Structure
            </p>
            <div className="mt-1 flex items-center gap-2">
              <Building2 className="size-4 text-muted-foreground" />
              <p className="text-sm font-medium">Organization root</p>
            </div>
          </div>

          {!readOnly && onAddRoot ? (
            <Button size="sm" onClick={onAddRoot}>
              <Plus className="size-4" />
              Add top-level unit
            </Button>
          ) : null}
        </div>

        <p className="mt-3 text-sm text-muted-foreground">
          {totalNodeCount === 0
            ? emptyDescription
            : `${totalNodeCount} units are currently planned beneath the organization root.`}
        </p>
      </div>

      {nodes.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-3 p-8 text-center">
          <div className="flex size-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
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
        <ScrollArea className="flex-1 p-3">
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
          "group/tree-row rounded-xl border border-transparent transition-colors",
          isSelected ? "border-border bg-muted/40" : "hover:bg-muted/20"
        )}
      >
        <div
          className="flex items-start gap-2 p-2"
          style={{ paddingLeft: `${node.level * 18 + 8}px` }}
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
              <span className="font-medium text-foreground">{node.displayName}</span>
              <Badge variant="secondary">{node.orgUnitKindLabel}</Badge>
              {node.isOrphaned ? <Badge variant="outline">Missing parent</Badge> : null}
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
              {node.businessCode ? <span>Business code {node.businessCode}</span> : null}
              {node.rowNumber ? <span>Row {node.rowNumber}</span> : null}
            </div>
          </button>

          {!readOnly && onAddChild ? (
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              className="opacity-0 transition-opacity group-hover/tree-row:opacity-100"
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