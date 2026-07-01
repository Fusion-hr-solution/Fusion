"use client";

import { memo } from "react";
import { Handle, Position, type NodeProps } from "@xyflow/react";
import { Building2, ChevronDown, ChevronUp, Network } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { OrgUnitFlowNode } from "./org-chart-layout";

export const OrgUnitNode = memo(function OrgUnitNode({
  data,
}: NodeProps<OrgUnitFlowNode>) {
  const { unit } = data;
  const handleClassName = cn(
    "!size-2 !border-2 !border-background",
    data.isSelected || data.isOnSelectedPath ? "!bg-primary" : "!bg-border"
  );
  const childCount = unit.children.length;
  const canToggle = data.isCollapsed || data.hasVisibleChildren;

  return (
    <div className="relative">
      {data.hasVisibleParent ? (
        <Handle
          type="target"
          position={Position.Top}
          className={handleClassName}
        />
      ) : null}

      <div
        className={cn(
          "w-[252px] cursor-pointer rounded-xl border border-border/70 bg-card shadow-sm transition-all duration-200",
          "hover:border-border hover:shadow-md",
          data.isOnSelectedPath && "border-primary/35 bg-primary/[0.04] shadow-md",
          data.isDeemphasized && "border-border/50 opacity-45",
          data.isSelected &&
            "border-primary bg-primary/[0.05] shadow-lg ring-2 ring-primary/40 opacity-100",
          data.isHighlighted &&
            !data.isSelected &&
            "shadow-lg ring-2 ring-primary/60"
        )}
      >
        <div className="flex items-start gap-3 p-3">
          <div className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Building2 className="size-4" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold leading-snug">
              {unit.name}
            </p>
            <p className="mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground">
              <span className="truncate">{unit.type}</span>
            </p>
            {unit.isOrphaned ? (
              <Badge variant="outline" className="mt-1.5">
                Detached
              </Badge>
            ) : null}
          </div>
        </div>

        <div className="flex items-center justify-between gap-2 border-t border-border/60 px-3 py-2 text-xs text-muted-foreground">
          <span className="truncate font-mono text-[11px] uppercase tracking-wide">
            {unit.code}
          </span>
          {childCount > 0 ? (
            <span className="flex shrink-0 items-center gap-1 font-medium text-foreground/70">
              <Network className="size-3.5" />
              {childCount} sub-unit{childCount === 1 ? "" : "s"}
            </span>
          ) : null}
        </div>
      </div>

      {canToggle ? (
        <button
          type="button"
          className={cn(
            "absolute bottom-0 left-1/2 z-10 flex -translate-x-1/2 translate-y-1/2 items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium shadow-sm transition-colors",
            data.isCollapsed
              ? "bg-primary text-primary-foreground hover:bg-primary/90"
              : "border border-border bg-card text-muted-foreground hover:bg-muted"
          )}
          aria-label={
            data.isCollapsed
              ? `Show ${childCount} sub-unit${childCount === 1 ? "" : "s"}`
              : "Collapse branch"
          }
          onClick={(event) => {
            event.stopPropagation();
            data.onToggleCollapse(unit.id);
          }}
        >
          {data.isCollapsed ? (
            <>
              <ChevronDown className="size-3" />
              {childCount}
            </>
          ) : (
            <ChevronUp className="size-3" />
          )}
        </button>
      ) : null}

      {data.hasVisibleChildren ? (
        <Handle
          type="source"
          position={Position.Bottom}
          className={handleClassName}
        />
      ) : null}
    </div>
  );
});
