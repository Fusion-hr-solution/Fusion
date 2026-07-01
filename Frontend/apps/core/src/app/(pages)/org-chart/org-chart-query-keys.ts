import type {
  OrgChartQueryParams,
  OrgUnitTreeQueryParams,
} from "./org-chart.types";

export function normalizeOrgChartQuery(query?: OrgChartQueryParams) {
  return {
    rootEmployeeId: query?.rootEmployeeId ?? null,
    focusEmployeeId: query?.focusEmployeeId ?? null,
    rootEmployeeKey: query?.rootEmployeeKey ?? null,
    focusEmployeeKey: query?.focusEmployeeKey ?? null,
    orgUnitId: query?.orgUnitId ?? null,
    orgUnitCode: query?.orgUnitCode ?? null,
    maxDepth: Math.min(Math.max(query?.maxDepth ?? 10, 1), 10),
    includeInactive: query?.includeInactive ?? false,
  };
}

export function normalizeOrgUnitTreeQuery(query?: OrgUnitTreeQueryParams) {
  return {
    rootId: query?.rootId ?? null,
    maxDepth: Math.min(Math.max(query?.maxDepth ?? 10, 1), 10),
    includeInactive: query?.includeInactive ?? false,
  };
}

export const orgChartQueryKeys = {
  all: () => ["corehr", "employees", "org-chart"] as const,
  chart: (query?: OrgChartQueryParams) =>
    [...orgChartQueryKeys.all(), normalizeOrgChartQuery(query)] as const,
};

export const orgUnitTreeQueryKeys = {
  all: () => ["corehr", "org-units", "tree"] as const,
  tree: (query?: OrgUnitTreeQueryParams) =>
    [...orgUnitTreeQueryKeys.all(), normalizeOrgUnitTreeQuery(query)] as const,
};
