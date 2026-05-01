import type {
  EmployeeHierarchyStatus,
  EmployeeRosterStatus,
} from "../employees/employee-roster.types";

export interface EmployeeOrgChartNodeDto {
  employeeId: string;
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

export interface EmployeeOrgChartDto {
  roots: EmployeeOrgChartNodeDto[];
  requestedRootEmployeeId: string | null;
  maxDepthApplied: number;
  includeInactive: boolean;
  totalVisibleNodeCount: number;
  isTruncated: boolean;
}

export interface OrgChartQueryParams {
  rootEmployeeId?: string | null;
  maxDepth?: number;
  includeInactive?: boolean;
}

export interface OrgChartSearchItem {
  employeeId: string;
  fullName: string;
  jobTitle: string | null;
  orgUnitName: string | null;
}