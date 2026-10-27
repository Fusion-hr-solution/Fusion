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
}

export const coreOrgChartPaths = {
  chart: () => "/corehr/org-chart",
} as const;

export const coreOrgChartQueryKeys = {
  all: () => ["core-org-chart"] as const,
  chart: (asOf: string | null) => [...coreOrgChartQueryKeys.all(), asOf ?? "today"] as const,
};

export function createCoreOrgChartApi(client: ApiClient) {
  return {
    chart: (asOf: string | null, signal?: AbortSignal) =>
      client.get<OrgChartDto>(coreOrgChartPaths.chart(), { params: asOf ? { asOf } : undefined, signal }),
  };
}

export type CoreOrgChartApi = ReturnType<typeof createCoreOrgChartApi>;
