"use client";

import { memo } from "react";
import { Handle, Position, type NodeProps } from "@xyflow/react";
import { Building2, ChevronDown, ChevronRight, GitBranch, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { getHierarchyIssueMeta } from "../employees/employee-hierarchy-status";
import type { OrgChartFlowNode } from "./org-chart-layout";

function getStatusVariant(status: OrgChartFlowNode["data"]["employee"]["employmentStatus"]) {
  return status === "Active" ? "secondary" : "outline";
}

export const OrgChartNode = memo(function OrgChartNode({
  data,
}: NodeProps<OrgChartFlowNode>) {
  const issueMeta = getHierarchyIssueMeta(data.employee.hierarchyStatus);
  const handleClassName = cn(
    "!size-2 !border-2 !border-background",
    data.isSelected || data.isOnSelectedPath ? "!bg-primary" : "!bg-border"
  );

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
          "w-[288px] border border-border/70 shadow-sm transition-all duration-200 hover:shadow-md",
          data.isOnSelectedPath && "border-primary/35 bg-primary/4 shadow-md",
          data.isDeemphasized && "border-border/50 opacity-60",
          data.isSelected && "border-primary ring-2 ring-primary/40 shadow-lg opacity-100",
          data.isHighlighted && !data.isSelected && "ring-2 ring-primary/60 shadow-lg"
        )}
      >
        <CardHeader className="border-b">
          <div className="flex min-w-0 items-start gap-3">
            <div className="min-w-0 flex-1">
              <CardTitle className="truncate">{data.employee.fullName}</CardTitle>
              <p className="truncate text-xs text-muted-foreground">
                {data.employee.jobTitle ?? "Job title not set"}
              </p>
            </div>
            <CardAction className="flex items-center gap-2">
              {data.employee.hasChildren ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  aria-label={data.isCollapsed ? "Expand branch" : "Collapse branch"}
                  onClick={(event) => {
                    event.stopPropagation();
                    data.onToggleCollapse(data.employee.employeeId);
                  }}
                >
                  {data.isCollapsed ? (
                    <ChevronRight className="size-4" />
                  ) : (
                    <ChevronDown className="size-4" />
                  )}
                </Button>
              ) : null}
            </CardAction>
          </div>
        </CardHeader>
        <CardContent>
          <button
            type="button"
            className={cn(
              "w-full rounded-lg border border-transparent p-3 text-left transition-colors hover:border-border hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              data.isSelected ? "bg-primary/8" : "bg-muted/20"
            )}
            aria-label={`Open reporting relationship for ${data.employee.fullName}`}
            onClick={() => data.onSelectEmployee(data.employee.employeeId)}
          >
            <div className="flex flex-wrap items-center gap-2">
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

            <div className="mt-3 space-y-2 text-xs text-muted-foreground">
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
          </button>
        </CardContent>
        <CardFooter className="justify-between gap-3 text-xs text-muted-foreground">
          <span>
            {issueMeta
              ? "Review reporting details"
              : "Open reporting details"}
          </span>
          <span>
            {data.employee.hasChildren ? "Team lead" : "Individual contributor"}
          </span>
        </CardFooter>
      </Card>
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