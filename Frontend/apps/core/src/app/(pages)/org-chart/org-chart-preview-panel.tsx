"use client";

import {
  ArrowUp,
  Building2,
  ExternalLink,
  Mail,
  Network,
  TreePine,
  Users,
  X,
} from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { getHierarchyIssueMeta } from "../employees/employee-hierarchy-status";
import { getAvatarStyle, getInitials } from "./org-chart-avatar";
import { getSpanOfControl } from "./org-chart-metrics";
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
  if (!employee) return null;

  const issueMeta = getHierarchyIssueMeta(employee.hierarchyStatus);
  const isInactive = employee.employmentStatus !== "Active";
  const span = getSpanOfControl(employee);
  const hasSecondaryNav =
    employee.hasChildren || !!employee.managerId || employee.directReportCount > 0;

  return (
    <div className="flex h-full w-80 flex-col bg-card">
      {/* Header */}
      <div className="flex shrink-0 items-start gap-3 p-4">
        <Avatar size="lg" className={isInactive ? "opacity-60" : undefined}>
          <AvatarFallback
            style={getAvatarStyle(employee.stableEmployeeKey)}
            className="font-medium"
          >
            {getInitials(employee.fullName)}
          </AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1">
          <p className="truncate font-semibold leading-tight">
            {employee.fullName}
          </p>
          {showJobTitle && employee.jobTitle ? (
            <p className="mt-0.5 truncate text-xs text-muted-foreground">
              {employee.jobTitle}
            </p>
          ) : null}
          {isInactive || issueMeta || !employee.orgUnitId || employee.isOrphaned ? (
            <div className="mt-2 flex flex-wrap items-center gap-1.5">
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
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label="Close preview"
          onClick={onClose}
        >
          <X className="size-4" />
        </Button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {/* Span-of-control metrics */}
        <div className="grid grid-cols-2 gap-2 px-4">
          <Metric label="Direct reports" value={span.directReports} />
          <Metric label="Team (visible)" value={span.visibleDownline} />
        </div>

        {/* Details */}
        <dl className="space-y-1 px-4 py-4 text-sm">
          <DetailRow
            icon={<Building2 className="size-4" />}
            label="Org unit"
            value={
              employee.orgUnitName ?? (
                <span className="text-muted-foreground">Not assigned</span>
              )
            }
          />
          <DetailRow
            icon={<Network className="size-4" />}
            label="Reports to"
            value={
              employee.managerName ? (
                employee.managerId ? (
                  <button
                    type="button"
                    className="truncate text-left text-primary hover:underline"
                    onClick={() => onViewManager(employee.managerId!)}
                  >
                    {employee.managerName}
                  </button>
                ) : (
                  employee.managerName
                )
              ) : employee.hierarchyStatus === "Root" ? (
                <span className="text-muted-foreground">Top-level leader</span>
              ) : (
                <span className="text-muted-foreground">No manager</span>
              )
            }
          />
          <DetailRow
            icon={<Mail className="size-4" />}
            label="Email"
            value={
              <a
                href={`mailto:${employee.email}`}
                className="truncate text-primary hover:underline"
              >
                {employee.email}
              </a>
            }
          />
        </dl>
      </div>

      {/* Actions */}
      <div className="shrink-0 space-y-2 border-t p-3">
        <Button className="w-full" onClick={() => onOpenProfile(employee.employeeId)}>
          <ExternalLink />
          Open full profile
        </Button>

        <div className="flex flex-col gap-0.5">
          {!isTenantContextReadOnly ? (
            <PanelAction
              icon={<Network className="size-4" />}
              title="Edit reporting lines"
              onClick={() => onManageReportingRelationship(employee.employeeId)}
            />
          ) : null}
          {hasSecondaryNav && employee.hasChildren ? (
            <PanelAction
              icon={<TreePine className="size-4" />}
              title="Focus this branch"
              onClick={() => onFocusBranch(employee.employeeId)}
            />
          ) : null}
          {employee.directReportCount > 0 ? (
            <PanelAction
              icon={<Users className="size-4" />}
              title={`View ${employee.directReportCount} direct report${employee.directReportCount === 1 ? "" : "s"}`}
              onClick={() => onViewDirectReports(employee.employeeId)}
            />
          ) : null}
          {employee.managerId ? (
            <PanelAction
              icon={<ArrowUp className="size-4" />}
              title="Go to manager"
              onClick={() => onViewManager(employee.managerId!)}
            />
          ) : null}
        </div>
      </div>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border bg-muted/30 px-3 py-2.5">
      <p className="text-xl font-semibold leading-none">{value}</p>
      <p className="mt-1.5 text-xs text-muted-foreground">{label}</p>
    </div>
  );
}

function DetailRow({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-3 py-1">
      <span className="flex w-5 shrink-0 justify-center text-muted-foreground">
        {icon}
      </span>
      <dt className="w-20 shrink-0 text-xs text-muted-foreground">{label}</dt>
      <dd className="min-w-0 flex-1 truncate">{value}</dd>
    </div>
  );
}

function PanelAction({
  icon,
  title,
  onClick,
}: {
  icon: React.ReactNode;
  title: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      className="flex items-center gap-3 rounded-lg px-3 py-2 text-left text-sm transition-colors hover:bg-muted"
      onClick={onClick}
    >
      <span className="flex size-7 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
        {icon}
      </span>
      <span className="min-w-0 truncate font-medium">{title}</span>
    </button>
  );
}
