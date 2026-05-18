"use client";

import {
  ArrowUp,
  Building2,
  ExternalLink,
  GitBranch,
  Network,
  TreePine,
  Users,
  X,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { getHierarchyIssueMeta } from "../employees/employee-hierarchy-status";
import type { EmployeeOrgChartNodeDto } from "./org-chart.types";

interface OrgChartPreviewPanelProps {
  employee: EmployeeOrgChartNodeDto | null;
  showJobTitle: boolean;
  onClose: () => void;
  onOpenProfile: (employeeId: string) => void;
  onManageReportingRelationship: (employeeId: string) => void;
  onFocusBranch: (employeeId: string) => void;
  onViewManager: (managerId: string) => void;
  onViewDirectReports: (employeeId: string) => void;
  isTenantContextReadOnly?: boolean;
}

function getStatusVariant(
  status: EmployeeOrgChartNodeDto["employmentStatus"]
): "secondary" | "outline" {
  return status === "Active" ? "secondary" : "outline";
}

function getManagerSummary(employee: EmployeeOrgChartNodeDto) {
  if (employee.managerName) {
    return `Reports to ${employee.managerName}`;
  }

  return employee.hierarchyStatus === "Root"
    ? "Top-level leader"
    : "No manager assigned";
}

export function OrgChartPreviewPanel({
  employee,
  showJobTitle,
  onClose,
  onOpenProfile,
  isTenantContextReadOnly,
  onManageReportingRelationship,
  onFocusBranch,
  onViewManager,
  onViewDirectReports,
}: OrgChartPreviewPanelProps) {
  if (!employee) {
    return null;
  }

  const issueMeta = getHierarchyIssueMeta(employee.hierarchyStatus);
  const hasChartNavActions =
    employee.hasChildren ||
    !!employee.managerId ||
    employee.directReportCount > 0;

  return (
    <div className="flex h-full w-80 flex-col overflow-y-auto bg-card">
      {/* Header */}
      <div className="flex shrink-0 items-start justify-between gap-3 border-b p-4">
        <div className="min-w-0 flex-1">
          <p className="truncate font-semibold leading-tight">
            {employee.fullName}
          </p>
          {showJobTitle && employee.jobTitle ? (
            <p className="mt-0.5 truncate text-xs text-muted-foreground">
              {employee.jobTitle}
            </p>
          ) : null}
        </div>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label="Close preview"
          onClick={onClose}
        >
          <X className="size-4" />
        </Button>
      </div>

      {/* Status badges */}
      <div className="flex shrink-0 flex-wrap items-center gap-2 px-4 pt-3">
        <Badge variant={getStatusVariant(employee.employmentStatus)}>
          {employee.employmentStatus}
        </Badge>
        {issueMeta ? (
          <Badge variant={issueMeta.variant}>{issueMeta.label}</Badge>
        ) : null}
        {!employee.orgUnitId ? <Badge variant="outline">Missing org unit</Badge> : null}
        {employee.isOrphaned ? (
          <Badge variant="outline">Detached branch</Badge>
        ) : null}
      </div>

      {/* Structure details */}
      <div className="shrink-0 space-y-2 px-4 py-3 text-sm text-muted-foreground">
        <div className="flex items-center gap-2">
          <Building2 className="size-3.5 shrink-0" />
          <span className="truncate">
            {employee.orgUnitName ?? (
              <span className="text-destructive">Missing org unit</span>
            )}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <GitBranch className="size-3.5 shrink-0" />
          <span className="truncate">{getManagerSummary(employee)}</span>
        </div>
        <div className="flex items-center gap-2">
          <Users className="size-3.5 shrink-0" />
          <span>
            {employee.directReportCount > 0
              ? `${employee.directReportCount} direct report${employee.directReportCount === 1 ? "" : "s"}`
              : "No direct reports"}
          </span>
        </div>
      </div>

      <Separator />

      {/* Primary actions */}
      <div className="flex shrink-0 flex-col gap-0.5 p-3">
        <button
          type="button"
          className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-colors hover:bg-muted"
          onClick={() => onOpenProfile(employee.employeeId)}
        >
          <div className="flex size-8 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
            <ExternalLink className="size-4" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-medium leading-none">Open profile</p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Full employee record
            </p>
          </div>
        </button>
        {!isTenantContextReadOnly ? (
          <button
            type="button"
            className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-colors hover:bg-muted"
            onClick={() => onManageReportingRelationship(employee.employeeId)}
          >
            <div className="flex size-8 shrink-0 items-center justify-center rounded-md bg-muted">
              <Network className="size-4" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-medium leading-none">
                Edit reporting lines
              </p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Change manager or direct reports
              </p>
            </div>
          </button>
        ) : null}
      </div>

      {hasChartNavActions ? (
        <>
          <Separator />

          <div className="shrink-0 px-4 pb-1 pt-3">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Chart navigation
            </p>
          </div>
          <div className="flex shrink-0 flex-col gap-0.5 px-3 pb-3">
            {employee.hasChildren ? (
              <button
                type="button"
                className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-colors hover:bg-muted"
                onClick={() => onFocusBranch(employee.employeeId)}
              >
                <div className="flex size-8 shrink-0 items-center justify-center rounded-md bg-muted">
                  <TreePine className="size-4" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-medium leading-none">
                    Focus this branch
                  </p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    Show this team only
                  </p>
                </div>
              </button>
            ) : null}
            {employee.managerId ? (
              <button
                type="button"
                className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-colors hover:bg-muted"
                onClick={() => onViewManager(employee.managerId!)}
              >
                <div className="flex size-8 shrink-0 items-center justify-center rounded-md bg-muted">
                  <ArrowUp className="size-4" />
                </div>
                <div className="min-w-0 overflow-hidden">
                  <p className="truncate text-sm font-medium leading-none">
                    {employee.managerName ?? "Go to manager"}
                  </p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    Select and center manager
                  </p>
                </div>
              </button>
            ) : null}
            {employee.directReportCount > 0 ? (
              <button
                type="button"
                className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-colors hover:bg-muted"
                onClick={() => onViewDirectReports(employee.employeeId)}
              >
                <div className="flex size-8 shrink-0 items-center justify-center rounded-md bg-muted">
                  <Users className="size-4" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-medium leading-none">
                    {employee.directReportCount} direct report
                    {employee.directReportCount !== 1 ? "s" : ""}
                  </p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    Zoom to the direct team
                  </p>
                </div>
              </button>
            ) : null}
          </div>
        </>
      ) : null}
    </div>
  );
}
