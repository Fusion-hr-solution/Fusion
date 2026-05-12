import type { OrgChartQueryParams } from "./org-chart.types";

export function normalizeOrgChartQuery(query?: OrgChartQueryParams) {
  return {
    rootEmployeeId: query?.rootEmployeeId ?? null,
    focusEmployeeId: query?.focusEmployeeId ?? null,
    orgUnitId: query?.orgUnitId ?? null,
    maxDepth: Math.min(Math.max(query?.maxDepth ?? 10, 1), 10),
    includeInactive: query?.includeInactive ?? false,
  };
}

export const orgChartQueryKeys = {
  all: () => ["corehr", "employees", "org-chart"] as const,
  chart: (query?: OrgChartQueryParams) =>
    [...orgChartQueryKeys.all(), normalizeOrgChartQuery(query)] as const,
};