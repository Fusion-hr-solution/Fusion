import type { ApiClient } from "./types";

/** A person on the org chart, shaped for the viewer by Core HR (fields the tenant hides from them are null). */
export interface OrgChartPersonDto {
  employeeKey: string;
  displayName: string;
  initials: string;
  jobTitle: string | null;
  unit: OrgChartUnitDto | null;
  workLocation: string | null;
  workEmail: string | null;
  /** Year the current employment started. */
  startYear: number | null;
  /** The full start date (yyyy-mm-dd), for HR only: the Tenure lens. */
  startDate: string | null;
  /** In the first 90 days of employment. */
  isNew: boolean;
  /** Null for the top of the company, or when the manager is outside the viewer's slice. */
  managerKey: string | null;
  dottedLineManagerKeys: string[];
  /** Whole-company counts, the same for every viewer. */
  directCount: number;
  totalCount: number;
}

export interface OrgChartUnitDto {
  id: string;
  name: string;
  /** The unit's top-level ancestor under the organization root; null for the root itself. */
  divisionId: string | null;
  divisionName: string | null;
}

/** People the viewer may not see, counted under the visible person they report up to. */
export interface OrgChartFoldDto {
  parentKey: string;
  count: number;
}

export type OrgChartScope = "Tenant" | "DirectReports";

/** `GET /api/corehr/org-chart`: the people org chart as of a date (another date than today is for HR). */
export interface OrgChartDto {
  asOf: string;
  scope: OrgChartScope;
  /** The viewer's own employee key; null without an employee record. */
  viewerKey: string | null;
  people: OrgChartPersonDto[];
  folded: OrgChartFoldDto[];
  /** Open roles under visible managers, from today on: Open for everyone, On hold for HR. */
  openRoles: OrgChartOpenRoleDto[];
}

/** Filled and Closed take a role off the chart. */
export type OpenRoleStatus = "Open" | "OnHold" | "Filled" | "Closed";

/** A role planned in a manager's line before anyone holds it: a dashed Hiring card. */
export interface OrgChartOpenRoleDto {
  id: string;
  jobTitle: string;
  managerKey: string;
  unit: OrgChartUnitDto | null;
  /** yyyy-mm-dd; null when not set. */
  targetStartDate: string | null;
  status: OpenRoleStatus;
}

/** `POST /api/corehr/org-chart/open-roles` and `PUT …/{id}` (people admins). A new role is Open or OnHold. */
export interface OpenRoleRequest {
  jobTitle: string;
  managerKey: string;
  orgUnitId: string;
  targetStartDate?: string | null;
  status?: OpenRoleStatus;
}

export type OrgChartChangeKind = "Join" | "Leave" | "Move";

/** A dated change: someone joins, leaves (`date` is their last day) or moves to a new manager. */
export interface OrgChartChangeDto {
  kind: OrgChartChangeKind;
  date: string;
  employeeKey: string;
  /** The manager they join or move to; null for a leaver. */
  managerKey: string | null;
  /** The joiner's card as of their first day; null for leavers and moves. */
  person: OrgChartPersonDto | null;
}

export const coreOrgChartPaths = {
  chart: () => "/corehr/org-chart",
  changes: () => "/corehr/org-chart/changes",
  openRoles: () => "/corehr/org-chart/open-roles",
  openRole: (id: string) => `/corehr/org-chart/open-roles/${encodeURIComponent(id)}`,
} as const;

export const coreOrgChartQueryKeys = {
  all: () => ["core-org-chart"] as const,
  chart: (asOf: string | null) => [...coreOrgChartQueryKeys.all(), asOf ?? "today"] as const,
  changes: (from: string, to: string) => [...coreOrgChartQueryKeys.all(), "changes", from, to] as const,
};

export function createCoreOrgChartApi(client: ApiClient) {
  return {
    chart: (asOf: string | null, signal?: AbortSignal) =>
      client.get<OrgChartDto>(coreOrgChartPaths.chart(), { params: asOf ? { asOf } : undefined, signal }),
    /** `GET /api/corehr/org-chart/changes`: HR only, both days included, two years at most. */
    changes: (from: string, to: string, signal?: AbortSignal) =>
      client.get<OrgChartChangeDto[]>(coreOrgChartPaths.changes(), { params: { from, to }, signal }),
    createOpenRole: (request: OpenRoleRequest) => client.post<OrgChartOpenRoleDto>(coreOrgChartPaths.openRoles(), request),
    updateOpenRole: (id: string, request: OpenRoleRequest) => client.put<OrgChartOpenRoleDto>(coreOrgChartPaths.openRole(id), request),
  };
}

export type CoreOrgChartApi = ReturnType<typeof createCoreOrgChartApi>;
