import { createPlatformApiClient, ApiError } from "@repo/api";
import { DEFAULT_PAGE_SIZE, DEFAULT_PAGE } from "@repo/ui";
import type { Employee, EmployeesPagedResult, EmployeeFilters } from "@/types/employee";
import {
  type BackendPagedResponse,
  type BackendEmployeeListItemDto,
  type BackendEmployeeDto,
  mapToEmployeesPagedResult,
  mapToEmployee,
} from "@/types/backend-dtos";

// API client instance
const client = createPlatformApiClient();

/** Get paginated list of employees from backend */
export async function getEmployees(
  filters: EmployeeFilters = {}
): Promise<EmployeesPagedResult> {
  const { 
    page = DEFAULT_PAGE, 
    pageSize = DEFAULT_PAGE_SIZE, 
    search, 
    department, 
    status, 
    sortBy, 
    sortDir 
  } = filters;

  const response = await client.get<BackendPagedResponse<BackendEmployeeListItemDto>>(
    "/corehr/employees",
    {
      params: {
        page,
        pageSize,
        search: search || undefined,
        department: department || undefined,
        status: status ? (status === "active" ? "Active" : "Inactive") : undefined,
        sortBy: sortBy || undefined,
        sortDir: sortDir || undefined,
      },
    }
  );

  return mapToEmployeesPagedResult(response);
}

/** Get a single employee by ID */
export async function getEmployeeById(id: string): Promise<Employee> {
  const response = await client.get<BackendEmployeeDto>(`/corehr/employees/${id}`);
  return mapToEmployee(response);
}

/** Get unique departments from employees */
export async function getDepartments(): Promise<string[]> {
  // Fetch a larger page to get department diversity
  const response = await client.get<BackendPagedResponse<BackendEmployeeListItemDto>>(
    "/corehr/employees",
    { params: { pageSize: 100 } }
  );

  const departments = new Set<string>();
  response.items.forEach((e) => {
    if (e.department) departments.add(e.department);
  });
  return Array.from(departments).sort();
}

/** Re-export ApiError for error handling */
export { ApiError };
