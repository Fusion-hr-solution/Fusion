import type {
  EmployeeHierarchyStatus,
  EmployeeRosterStatus,
} from "../employees/employee-roster.types";

export interface EmployeeOrgChartNodeDto {
  employeeId: string;
  stableEmployeeKey: string;
  fullName: string;
  firstName: string;
  lastName: string;
  email: string;
  jobTitle: string | null;
  employmentStatus: EmployeeRosterStatus;
  orgUnitId: string | null;
  orgUnitName: string | null;
  managerId: string | null;
  managerName: string | null;
  hierarchyStatus: EmployeeHierarchyStatus;
  directReportCount: number;
  hasChildren: boolean;
  isOrphaned: boolean;
  level: number;
  children: EmployeeOrgChartNodeDto[];
  version: number;
}

export interface OrgChartIssueCountsDto {
  noManagerAssigned: number;
  managerInactive: number;
  managerMissing: number;
  missingOrgUnit: number;
}

export interface EmployeeOrgChartDto {
  roots: EmployeeOrgChartNodeDto[];
  requestedRootEmployeeId: string | null;
  focusedEmployeeId: string | null;
  selectedOrgUnitId: string | null;
  maxDepthApplied: number;
  includeInactive: boolean;
  totalVisibleNodeCount: number;
  isTruncated: boolean;
  issueCounts: OrgChartIssueCountsDto;
}

export interface OrgChartQueryParams {
  rootEmployeeId?: string | null;
  focusEmployeeId?: string | null;
  rootEmployeeKey?: string | null;
  focusEmployeeKey?: string | null;
  orgUnitId?: string | null;
  orgUnitCode?: string | null;
  maxDepth?: number;
  includeInactive?: boolean;
}

export interface OrgChartSearchItem {
  employeeId: string;
  fullName: string;
  jobTitle: string | null;
  orgUnitName: string | null;
}

/** Which lens the canvas is rendering. People = reporting hierarchy; Structure = org-unit tree. */
export type OrgChartLens = "people" | "structure";

/** Mirrors CoreHR OrgUnitTreeNodeDto (GET /corehr/org-units/tree). */
export interface OrgUnitTreeNodeDto {
  id: string;
  code: string;
  name: string;
  type: string;
  level: number;
  isOrphaned: boolean;
  children: OrgUnitTreeNodeDto[];
}

export interface OrgUnitTreeQueryParams {
  rootId?: string | null;
  maxDepth?: number;
  includeInactive?: boolean;
}

/** Lightweight search item for the unified command-bar search in structure lens. */
export interface OrgUnitSearchItem {
  orgUnitId: string;
  code: string;
  name: string;
  type: string;
  childUnitCount: number;
}

/**
 * Span-of-control summary. `visibleDownline` counts only descendants present in the
 * loaded/visible tree — permission- and scope-consistent by construction (it never
 * counts nodes the caller cannot see), per the org-chart spec.
 */
export interface SpanOfControl {
  directReports: number;
  visibleDownline: number;
}
