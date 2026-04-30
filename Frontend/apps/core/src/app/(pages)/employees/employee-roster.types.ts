export type EmployeeRosterStatus = "Active" | "Inactive";

export type EmployeeHierarchyStatus =
  | "Healthy"
  | "NoManagerAssigned"
  | "ManagerInactive"
  | "ManagerMissing";

export type EmployeeRosterSortField = "Name" | "Email" | "HireDate" | "Status";

export type EmployeeRosterSortDirection = "Asc" | "Desc";

export interface EmployeeRosterItem {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  orgUnitId: string | null;
  orgUnitName: string | null;
  jobTitle: string | null;
  status: EmployeeRosterStatus;
  hireDate: string;
  managerId: string | null;
  managerName: string | null;
  hierarchyStatus: EmployeeHierarchyStatus;
  directReportCount: number;
  version: number;
}

export interface EmployeeRosterPageDto {
  items: EmployeeRosterItem[];
  totalCount: number;
  page: number;
  pageSize: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
}

export interface EmployeeRosterQueryParams {
  search?: string;
  status?: EmployeeRosterStatus;
  sortBy: EmployeeRosterSortField;
  sortDir: EmployeeRosterSortDirection;
  page: number;
  pageSize: number;
}

export interface EmployeeHierarchyNodeDto {
  employee: EmployeeRosterItem;
  depth: number;
}

export interface EmployeeReportingLinesDto {
  employee: EmployeeRosterItem;
  managerChain: EmployeeHierarchyNodeDto[];
  directReports: EmployeeHierarchyNodeDto[];
  downline: EmployeeHierarchyNodeDto[];
  directReportCount: number;
  downlineCount: number;
}
export interface EmployeeOrgUnitOption {
  id: string;
  code: string;
  name: string;
  type: string;
  parentId: string | null;
  parentName: string | null;
  isActive: boolean;
}

export interface EmployeeOrgUnitPageDto {
  items: EmployeeOrgUnitOption[];
  totalCount: number;
  page: number;
  pageSize: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
}

export interface EmployeeProfileDto {
  id: string;
  firstName: string;
  lastName: string;
  fullName: string;
  email: string;
  jobTitle: string | null;
  hireDate: string;
  status: EmployeeRosterStatus;
  orgUnitId: string | null;
  orgUnitName: string | null;
  managerId: string | null;
  managerFirstName: string | null;
  managerLastName: string | null;
  managerEmail: string | null;
  managerFullName: string | null;
  hierarchyStatus: EmployeeHierarchyStatus;
  directReportCount: number;
  version: number;
}
