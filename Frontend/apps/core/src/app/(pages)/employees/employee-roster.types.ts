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
