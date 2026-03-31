/**
 * Backend DTO types matching CoreHR API response shapes.
 * These mirror the C# DTOs exactly for type-safe API integration.
 */

import type { Employee, EmployeeListItem, EmployeesPagedResult } from "./employee";

/** Backend employee list item (matches EmployeeListItemDto.cs) */
export interface BackendEmployeeListItemDto {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  department: string | null;
  jobTitle: string | null;
  status: "Active" | "Inactive";
  hireDate: string;
  managerId: string | null;
  managerName: string | null;
}

/** Backend manager info (matches ManagerDto.cs) */
export interface BackendManagerDto {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
}

/** Backend full employee (matches EmployeeDto.cs) */
export interface BackendEmployeeDto {
  id: string;
  tenantId: string;
  firstName: string;
  lastName: string;
  email: string;
  department: string | null;
  jobTitle: string | null;
  hireDate: string;
  status: "Active" | "Inactive";
  managerId: string | null;
  manager: BackendManagerDto | null;
  createdAt: string;
  updatedAt: string | null;
  version: number;
}

/** Backend paged response (matches PagedResponse.cs) */
export interface BackendPagedResponse<T> {
  items: T[];
  totalCount: number;
  page: number;
  pageSize: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
}

// ─────────────────────────────────────────────────────────────
// Mappers: Backend → Frontend
// ─────────────────────────────────────────────────────────────

/** Map backend status to frontend status (Active → active) */
function mapStatus(status: "Active" | "Inactive"): "active" | "inactive" {
  return status.toLowerCase() as "active" | "inactive";
}

/** Map backend list item to frontend list item */
export function mapToEmployeeListItem(dto: BackendEmployeeListItemDto): EmployeeListItem {
  return {
    id: dto.id,
    firstName: dto.firstName,
    lastName: dto.lastName,
    fullName: `${dto.firstName} ${dto.lastName}`,
    email: dto.email,
    department: dto.department,
    jobTitle: dto.jobTitle,
    status: mapStatus(dto.status),
    hireDate: dto.hireDate,
    managerId: dto.managerId,
    managerName: dto.managerName,
  };
}

/** Map backend employee to frontend employee */
export function mapToEmployee(dto: BackendEmployeeDto): Employee {
  return {
    id: dto.id,
    firstName: dto.firstName,
    lastName: dto.lastName,
    fullName: `${dto.firstName} ${dto.lastName}`,
    email: dto.email,
    department: dto.department,
    jobTitle: dto.jobTitle,
    status: mapStatus(dto.status),
    hireDate: dto.hireDate,
    managerId: dto.managerId,
    managerName: dto.manager ? `${dto.manager.firstName} ${dto.manager.lastName}` : null,
    manager: dto.manager
      ? {
          id: dto.manager.id,
          firstName: dto.manager.firstName,
          lastName: dto.manager.lastName,
          fullName: `${dto.manager.firstName} ${dto.manager.lastName}`,
          email: dto.manager.email,
        }
      : null,
  };
}

/** Map backend paged response to frontend paged result */
export function mapToEmployeesPagedResult(
  response: BackendPagedResponse<BackendEmployeeListItemDto>
): EmployeesPagedResult {
  return {
    items: response.items.map(mapToEmployeeListItem),
    totalCount: response.totalCount,
    page: response.page,
    pageSize: response.pageSize,
    totalPages: response.totalPages,
  };
}
