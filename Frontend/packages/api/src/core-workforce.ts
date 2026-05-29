export interface WorkforceManagerSummaryDto {
  employeeId: string;
  displayName: string;
  email: string;
  isActive: boolean;
}

export interface WorkforceOrgAssignmentDto {
  orgUnitId: string;
  stableOrgUnitKey: string;
  name: string;
  type: string;
  parentStableOrgUnitKey: string | null;
  path: string;
  level: number;
  isActive: boolean;
  publishedStructureVersion: number;
}

export interface WorkforceDataQualityDto {
  state: "Ready" | "NeedsAttention" | "Blocked" | string;
  hasEmployeeStateIssues: boolean;
  hasOperationalBlockers: boolean;
  issueCodes: string[];
}

export interface WorkforceEmployeeSummaryDto {
  employeeId: string;
  stableEmployeeKey: string;
  employeeNumber: string | null;
  firstName: string;
  lastName: string;
  preferredName: string | null;
  displayName: string;
  fullName: string;
  workEmail: string;
  jobTitle: string | null;
  hireDate: string;
  employmentStatus: string;
  isActive: boolean;
  orgUnit: WorkforceOrgAssignmentDto | null;
  manager: WorkforceManagerSummaryDto | null;
  directReportCount: number;
  dataQuality: WorkforceDataQualityDto;
  version: number;
}

export interface WorkforceAccessSubjectSummaryDto {
  employeeId: string;
  firstName: string;
  lastName: string;
  displayName: string;
  workEmail: string;
  employmentStatus: string;
  isActive: boolean;
}

export interface WorkforceManagerScopeDto {
  scopeType: string;
  managerEmployeeId: string;
  directReportCount: number;
  includesIndirectReports: boolean;
}

export interface WorkforceCurrentUserContextDto {
  userId: string;
  tenantId: string;
  employeeId: string | null;
  roles: string[];
  employee: WorkforceEmployeeSummaryDto | null;
  managerScope: WorkforceManagerScopeDto | null;
  isWorkforceLinked: boolean;
  publishedStructureVersion: number;
  isStructureOperational: boolean;
}

export interface WorkforceEmployeeResolveRequest {
  employeeIds: string[];
}

export interface WorkforceOrgUnitSummaryDto {
  id: string;
  stableKey: string;
  name: string;
  type: string;
  parentStableKey: string | null;
  path: string;
  level: number;
  isActive: boolean;
  publishedStructureVersion: number;
}

export interface WorkforceOrgUnitTreeNodeDto {
  id: string;
  stableKey: string;
  name: string;
  type: string;
  parentStableKey: string | null;
  path: string;
  level: number;
  isActive: boolean;
  publishedStructureVersion: number;
  children: WorkforceOrgUnitTreeNodeDto[];
}

export interface WorkforceOrgUnitTreeDto {
  roots: WorkforceOrgUnitTreeNodeDto[];
  publishedStructureVersion: number;
}

export interface WorkforceEmployeePageDto {
  items: WorkforceEmployeeSummaryDto[];
  totalCount: number;
  page: number;
  pageSize: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
}

export interface WorkforceAccessSubjectPageDto {
  items: WorkforceAccessSubjectSummaryDto[];
  totalCount: number;
  page: number;
  pageSize: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
}

export const coreWorkforcePaths = {
  me: () => "/corehr/workforce/me",
  employee: (employeeId: string) => `/corehr/workforce/employees/${employeeId}`,
  resolve: () => "/corehr/workforce/employees/resolve",
  search: () => "/corehr/workforce/employees/search",
  accessSubjects: () => "/corehr/workforce/access-subjects",
  team: (employeeId: string) => `/corehr/workforce/employees/${employeeId}/team`,
  managerChain: (employeeId: string) => `/corehr/workforce/employees/${employeeId}/manager-chain`,
  orgUnits: () => "/corehr/workforce/org-units",
  orgUnitTree: () => "/corehr/workforce/org-units/tree",
} as const;

export const coreWorkforceQueryKeys = {
  all: () => ["coreWorkforce"] as const,
  me: () => [...coreWorkforceQueryKeys.all(), "me"] as const,
  employees: () => [...coreWorkforceQueryKeys.all(), "employees"] as const,
  employee: (employeeId: string) =>
    [...coreWorkforceQueryKeys.employees(), employeeId] as const,
  resolve: (employeeIds: readonly string[]) =>
    [...coreWorkforceQueryKeys.employees(), "resolve", [...employeeIds].sort()] as const,
  search: (params: { search?: string | null; page: number; pageSize: number }) =>
    [
      ...coreWorkforceQueryKeys.employees(),
      "search",
      {
        search: params.search?.trim() || null,
        page: params.page,
        pageSize: params.pageSize,
      },
    ] as const,
  accessSubjects: (params: {
    search?: string | null;
    page: number;
    pageSize: number;
  }) =>
    [
      ...coreWorkforceQueryKeys.all(),
      "access-subjects",
      {
        search: params.search?.trim() || null,
        page: params.page,
        pageSize: params.pageSize,
      },
    ] as const,
  team: (employeeId: string) =>
    [...coreWorkforceQueryKeys.employees(), employeeId, "team"] as const,
  managerChain: (employeeId: string) =>
    [...coreWorkforceQueryKeys.employees(), employeeId, "manager-chain"] as const,
  orgUnits: (includeInactive: boolean) =>
    [...coreWorkforceQueryKeys.all(), "org-units", includeInactive] as const,
  orgUnitTree: (params: { rootId?: string | null; maxDepth?: number; includeInactive?: boolean }) =>
    [
      ...coreWorkforceQueryKeys.all(),
      "org-unit-tree",
      {
        rootId: params.rootId ?? null,
        maxDepth: params.maxDepth ?? 10,
        includeInactive: params.includeInactive ?? false,
      },
    ] as const,
} as const;
