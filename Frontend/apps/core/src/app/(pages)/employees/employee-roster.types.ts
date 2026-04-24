export type EmployeeRosterStatus = "Active" | "Inactive";

export type EmployeeRosterSortField =
  | "Name"
  | "Email"
  | "Department"
  | "HireDate"
  | "Status";

export type EmployeeRosterSortDirection = "Asc" | "Desc";

export interface EmployeeRosterItem {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  department: string | null;
  orgUnitId: string | null;
  orgUnitName: string | null;
  jobTitle: string | null;
  status: EmployeeRosterStatus;
  hireDate: string;
  managerId: string | null;
  managerName: string | null;
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