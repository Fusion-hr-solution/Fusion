import type { EmployeeImportPreviewFilter } from "./import/employee-import.types";
import type {
  EmployeeRosterQueryParams,
  WorkforceAccountSubject,
} from "./employee-roster.types";

export const DEFAULT_EMPLOYEE_IMPORT_HISTORY_PAGE_SIZE = 10;
export const DEFAULT_EMPLOYEE_IMPORT_PREVIEW_PAGE_SIZE = 5;
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

function normalizeWorkforceAccountSubject(subject: WorkforceAccountSubject) {
  return {
    employeeId: subject.employeeId,
    email: normalizeEmployeeRosterSearch(subject.email)?.toLowerCase() ?? null,
    firstName: normalizeEmployeeRosterSearch(subject.firstName ?? undefined),
    lastName: normalizeEmployeeRosterSearch(subject.lastName ?? undefined),
  };
}

function normalizeWorkforceAccountSubjects(
  subjects: WorkforceAccountSubject[]
) {
  return [...subjects]
    .map(normalizeWorkforceAccountSubject)
    .sort((left, right) => left.employeeId.localeCompare(right.employeeId));
}

export function normalizeEmployeeRosterQuery(
  params: EmployeeRosterQueryParams
) {
  return {
    search: normalizeEmployeeRosterSearch(params.search),
    status: params.status ?? null,
    orgUnitId: params.orgUnitId ?? null,
    orgUnitCode: params.orgUnitCode ?? null,
    managerId: params.managerId ?? null,
    access: params.access ?? null,
    readiness: params.readiness ?? null,
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
  details: (employeeKey: string) =>
    [...employeeRosterQueryKeys.all(), "details", "by-key", employeeKey] as const,
  detailsById: (employeeId: string) =>
    [...employeeRosterQueryKeys.all(), "details", "by-id", employeeId] as const,
  readinessSummary: () =>
    [...employeeRosterQueryKeys.all(), "readiness-summary"] as const,
  workforceAccounts: () =>
    [...employeeRosterQueryKeys.all(), "workforce-accounts"] as const,
  workforceAccountSummary: () =>
    [...employeeRosterQueryKeys.workforceAccounts(), "summary"] as const,
  workforceAccount: (employeeId: string) =>
    [...employeeRosterQueryKeys.workforceAccounts(), employeeId] as const,
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
  applyOperations: () => [...employeeImportQueryKeys.all(), "apply"] as const,
  applyOperation: (sessionId: string) =>
    [...employeeImportQueryKeys.applyOperations(), sessionId] as const,
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
