"use client";

import { memo } from "react";
import { Handle, Position, type NodeProps } from "@xyflow/react";
import { Building2, ChevronDown, ChevronUp, Users } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { getHierarchyIssueMeta } from "../employees/employee-hierarchy-status";
import { getAvatarStyle, getInitials } from "./org-chart-avatar";
import type { OrgChartFlowNode } from "./org-chart-layout";

export const OrgChartNode = memo(function OrgChartNode({
  data,
  dragging,
}: NodeProps<OrgChartFlowNode>) {
  const { employee } = data;
  const issueMeta = getHierarchyIssueMeta(employee.hierarchyStatus);
  const isInactive = employee.employmentStatus !== "Active";
  const handleClassName = cn(
    "!size-2 !border-2 !border-background",
    data.isSelected || data.isOnSelectedPath ? "!bg-primary" : "!bg-border"
  );
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
          "w-[288px] rounded-xl border border-border/70 bg-card shadow-sm transition-all duration-200",
          "hover:border-border hover:shadow-md",
          data.isReassignMode ? "cursor-grab" : "cursor-pointer",
          data.isOnSelectedPath && "border-primary/35 bg-primary/[0.04] shadow-md",
          data.isDeemphasized && "border-border/50 opacity-45",
          data.isSelected &&
            "border-primary bg-primary/[0.05] shadow-lg ring-2 ring-primary/40 opacity-100",
          data.isHighlighted &&
            !data.isSelected &&
            "shadow-lg ring-2 ring-primary/60",
          data.isDropTarget &&
            !dragging &&
            "border-emerald-500/60 shadow-lg ring-2 ring-emerald-500/50",
          dragging &&
            "scale-[1.02] cursor-grabbing border-primary/70 opacity-95 shadow-2xl"
        )}
      >
        {/* Identity row */}
        <div className="flex items-start gap-3 p-3">
          <Avatar size="lg" className="mt-0.5">
            <AvatarFallback
              style={getAvatarStyle(employee.stableEmployeeKey)}
              className="font-medium"
            >
              {getInitials(employee.fullName)}
            </AvatarFallback>
          </Avatar>

          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold leading-snug">
              {employee.fullName}
            </p>
            {data.showJobTitle && employee.jobTitle ? (
              <p className="mt-0.5 truncate text-xs text-muted-foreground">
                {employee.jobTitle}
              </p>
            ) : null}

            {/* Sparse badges — only surface exceptions, never the default "Active" state */}
            {isInactive || issueMeta || !employee.orgUnitId || employee.isOrphaned ? (
              <div className="mt-1.5 flex flex-wrap items-center gap-1">
                {isInactive ? <Badge variant="outline">Inactive</Badge> : null}
                {issueMeta ? (
                  <Badge variant={issueMeta.variant}>{issueMeta.label}</Badge>
                ) : null}
                {!employee.orgUnitId ? (
                  <Badge variant="outline">No org unit</Badge>
                ) : null}
                {employee.isOrphaned ? (
                  <Badge variant="outline">Detached</Badge>
                ) : null}
              </div>
            ) : null}
          </div>
        </div>

        {/* Context row */}
        <div className="flex items-center justify-between gap-2 border-t border-border/60 px-3 py-2 text-xs text-muted-foreground">
          <span className="flex min-w-0 items-center gap-1.5">
            <Building2 className="size-3.5 shrink-0" />
            <span className="truncate">
              {employee.orgUnitName ?? "—"}
            </span>
          </span>
          {employee.directReportCount > 0 ? (
            <span className="flex shrink-0 items-center gap-1 font-medium text-foreground/70">
              <Users className="size-3.5" />
              {employee.directReportCount}
            </span>
          ) : null}
        </div>
      </div>

      {/* Branch toggle — sits over the bottom source handle so its relationship to the
          subtree below is obvious. */}
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
              ? `Show ${employee.directReportCount} direct report${employee.directReportCount === 1 ? "" : "s"}`
              : "Collapse branch"
          }
          onClick={(event) => {
            event.stopPropagation();
            data.onToggleCollapse(employee.employeeId);
          }}
        >
          {data.isCollapsed ? (
            <>
              <ChevronDown className="size-3" />
              {employee.directReportCount}
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
