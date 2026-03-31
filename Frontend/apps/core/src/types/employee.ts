/** Core employee data returned by list endpoints */
export interface EmployeeListItem {
  id: string;
  firstName: string;
  lastName: string;
  fullName: string;
  email: string;
  department: string | null;
  jobTitle: string | null;
  status: "active" | "inactive";
  hireDate: string;
  managerId: string | null;
  managerName: string | null;
}

/** Full employee profile */
export interface Employee extends EmployeeListItem {
  manager?: {
    id: string;
    firstName: string;
    lastName: string;
    fullName: string;
    email: string;
  } | null;
}

/** Paged result for employee lists */
export interface EmployeesPagedResult {
  items: EmployeeListItem[];
  totalCount: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

/** Backend-supported sort fields */
export type EmployeeSortField = "Name" | "Email" | "Department" | "HireDate" | "Status";

/** Sort direction */
export type SortDirection = "Asc" | "Desc";

/** Filters for employee queries */
export interface EmployeeFilters {
  search?: string;
  department?: string;
  status?: "active" | "inactive";
  page?: number;
  pageSize?: number;
  sortBy?: EmployeeSortField;
  sortDir?: SortDirection;
}
