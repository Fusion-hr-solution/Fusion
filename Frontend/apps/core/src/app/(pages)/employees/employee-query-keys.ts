import type { EmployeeImportPreviewFilter } from "./import/employee-import.types";
import type { EmployeeRosterQueryParams } from "./employee-roster.types";

export const DEFAULT_EMPLOYEE_IMPORT_HISTORY_PAGE_SIZE = 10;
export const DEFAULT_EMPLOYEE_IMPORT_PREVIEW_PAGE_SIZE = 25;
export const MIN_EMPLOYEE_IMPORT_PREVIEW_PAGE_SIZE = 1;
export const MAX_EMPLOYEE_IMPORT_PREVIEW_PAGE_SIZE = 100;

export type EmployeeImportPreviewQuery = {
  pageNumber?: number;
  pageSize?: number;
  previewFilter?: EmployeeImportPreviewFilter;
  groupKey?: string | null;
};

export type EmployeeImportHistoryQuery = {
  pageNumber?: number;
  pageSize?: number;
};

function normalizeEmployeeRosterSearch(search?: string): string | null {
  const trimmed = search?.trim();
  return trimmed ? trimmed : null;
}

export function normalizeEmployeeRosterQuery(
  params: EmployeeRosterQueryParams
) {
  return {
    search: normalizeEmployeeRosterSearch(params.search),
    status: params.status ?? null,
    sortBy: params.sortBy,
    sortDir: params.sortDir,
    page: params.page,
    pageSize: params.pageSize,
  };
}

export const employeeRosterQueryKeys = {
  all: () => ["corehr", "employees", "roster"] as const,
  lists: () => [...employeeRosterQueryKeys.all(), "list"] as const,
  list: (params: EmployeeRosterQueryParams) =>
    [
      ...employeeRosterQueryKeys.lists(),
      normalizeEmployeeRosterQuery(params),
    ] as const,
  managerOptions: (search: string) =>
    [
      ...employeeRosterQueryKeys.all(),
      "manager-options",
      normalizeEmployeeRosterSearch(search),
    ] as const,
  orgUnitOptions: (search: string) =>
    [
      ...employeeRosterQueryKeys.all(),
      "org-unit-options",
      normalizeEmployeeRosterSearch(search),
    ] as const,
  reportingLines: (employeeId: string) =>
    [...employeeRosterQueryKeys.all(), "reporting-lines", employeeId] as const,
  profile: (employeeId: string) =>
    [...employeeRosterQueryKeys.all(), "profile", employeeId] as const,
};

export function normalizeEmployeeImportPreviewQuery(
  query?: EmployeeImportPreviewQuery
) {
  const rawPageNumber = query?.pageNumber ?? 1;
  const rawPageSize =
    query?.pageSize ?? DEFAULT_EMPLOYEE_IMPORT_PREVIEW_PAGE_SIZE;

  return {
    pageNumber: Math.max(rawPageNumber, 1),
    pageSize: Math.min(
      Math.max(rawPageSize, MIN_EMPLOYEE_IMPORT_PREVIEW_PAGE_SIZE),
      MAX_EMPLOYEE_IMPORT_PREVIEW_PAGE_SIZE
    ),
    previewFilter: query?.previewFilter ?? "all",
    groupKey: query?.groupKey ?? null,
  };
}

export function normalizeEmployeeImportHistoryQuery(
  query?: EmployeeImportHistoryQuery
) {
  return {
    pageNumber: query?.pageNumber ?? 1,
    pageSize: query?.pageSize ?? DEFAULT_EMPLOYEE_IMPORT_HISTORY_PAGE_SIZE,
  };
}

export const employeeImportQueryKeys = {
  all: () => ["corehr", "employees", "import"] as const,
  schema: () => [...employeeImportQueryKeys.all(), "schema"] as const,
  sessions: () => [...employeeImportQueryKeys.all(), "session"] as const,
  session: (sessionId: string) =>
    [...employeeImportQueryKeys.sessions(), sessionId] as const,
  sessionView: (sessionId: string, query?: EmployeeImportPreviewQuery) =>
    [
      ...employeeImportQueryKeys.session(sessionId),
      normalizeEmployeeImportPreviewQuery(query),
    ] as const,
  history: () => [...employeeImportQueryKeys.all(), "history"] as const,
  historyPage: (query?: EmployeeImportHistoryQuery) =>
    [
      ...employeeImportQueryKeys.history(),
      "page",
      normalizeEmployeeImportHistoryQuery(query),
    ] as const,
  historyDetails: () =>
    [...employeeImportQueryKeys.history(), "detail"] as const,
  historyDetail: (historyId: string) =>
    [...employeeImportQueryKeys.historyDetails(), historyId] as const,
};
