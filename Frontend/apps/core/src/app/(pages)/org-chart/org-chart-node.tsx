"use client";

import { memo } from "react";
import { Handle, Position, type NodeProps } from "@xyflow/react";
import { Building2, GitBranch, Minus, Plus, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { getHierarchyIssueMeta } from "../employees/employee-hierarchy-status";
import type { OrgChartFlowNode } from "./org-chart-layout";

function getStatusVariant(
  status: OrgChartFlowNode["data"]["employee"]["employmentStatus"]
) {
  return status === "Active" ? "secondary" : "outline";
}

export const OrgChartNode = memo(function OrgChartNode({
  data,
  dragging,
}: NodeProps<OrgChartFlowNode>) {
  const issueMeta = getHierarchyIssueMeta(data.employee.hierarchyStatus);
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
      <Card
        size="sm"
        className={cn(
          "w-[288px] border border-border/70 shadow-sm transition-all duration-200 hover:border-border hover:shadow-md",
          data.isReassignMode ? "cursor-grab" : "cursor-pointer",
          data.isOnSelectedPath && "border-primary/35 bg-primary/5 shadow-md",
          data.isDeemphasized && "border-border/50 opacity-50",
          data.isSelected &&
            "border-primary bg-primary/5 ring-2 ring-primary/40 shadow-lg opacity-100",
          data.isHighlighted &&
            !data.isSelected &&
            "ring-2 ring-primary/60 shadow-lg",
          data.isDropTarget &&
            !dragging &&
            "border-emerald-500/60 ring-2 ring-emerald-500/50 shadow-lg",
          dragging &&
            "cursor-grabbing border-primary/70 shadow-2xl opacity-95 scale-[1.02]"
        )}
      >
        <CardHeader className="border-b">
          <div className="min-w-0 flex-1">
            <CardTitle className="truncate leading-snug">
              {data.employee.fullName}
            </CardTitle>
            {data.showJobTitle && data.employee.jobTitle ? (
              <p className="mt-0.5 truncate text-xs text-muted-foreground">
                {data.employee.jobTitle}
              </p>
            ) : null}
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap items-center gap-1.5">
            <Badge variant={getStatusVariant(data.employee.employmentStatus)}>
              {data.employee.employmentStatus}
            </Badge>
            {issueMeta ? (
              <Badge variant={issueMeta.variant}>{issueMeta.label}</Badge>
            ) : null}
            {data.employee.isOrphaned ? (
              <Badge variant="outline">Detached branch</Badge>
            ) : null}
          </div>

          <div className="mt-3 space-y-1.5 text-xs text-muted-foreground">
            <div className="flex items-center gap-2">
              <Building2 className="size-3.5 shrink-0" />
              <span className="truncate">
                {data.employee.orgUnitName ?? "No org unit assigned"}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Users className="size-3.5 shrink-0" />
              <span>
                {data.employee.directReportCount > 0
                  ? `Leads ${data.employee.directReportCount} direct report${data.employee.directReportCount === 1 ? "" : "s"}`
                  : "No direct reports"}
              </span>
            </div>
            {data.employee.managerName ? (
              <div className="flex items-center gap-2">
                <GitBranch className="size-3.5 shrink-0" />
                <span className="truncate">
                  Reports to {data.employee.managerName}
                </span>
              </div>
            ) : null}
          </div>
        </CardContent>
      </Card>

      {/* Branch toggle — sits at the bottom of the node, over the source handle,
          so the spatial relationship to the hierarchy below is obvious */}
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
              ? `Show ${data.employee.directReportCount} direct report${data.employee.directReportCount === 1 ? "" : "s"}`
              : "Collapse branch"
          }
          onClick={(event) => {
            event.stopPropagation();
            data.onToggleCollapse(data.employee.employeeId);
          }}
        >
          {data.isCollapsed ? (
            <>
              <Plus className="size-3" />
              {data.employee.directReportCount}
            </>
          ) : (
            <Minus className="size-3" />
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
