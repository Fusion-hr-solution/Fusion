import type {
  EmployeeRosterQueryParams,
  WorkforceAccountSubject,
} from "./employee-roster.types";

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
