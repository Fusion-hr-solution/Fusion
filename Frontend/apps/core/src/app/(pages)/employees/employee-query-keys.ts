import type { EmployeeImportPreviewFilter } from "./import/employee-import.types";
import type { EmployeeRosterQueryParams } from "./employee-roster.types";

export const DEFAULT_EMPLOYEE_IMPORT_HISTORY_PAGE_SIZE = 10;

export type EmployeeImportPreviewQuery = {
  pageNumber?: number;
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
  list: (params: EmployeeRosterQueryParams) =>
    [
      ...employeeRosterQueryKeys.all(),
      "list",
      normalizeEmployeeRosterQuery(params),
    ] as const,
};

export function normalizeEmployeeImportPreviewQuery(
  query?: EmployeeImportPreviewQuery
) {
  return {
    pageNumber: query?.pageNumber ?? 1,
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
