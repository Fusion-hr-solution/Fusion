"use client";

import { useCallback, useMemo } from "react";
import { createPlatformApiClient } from "@repo/api";
import {
  keepPreviousData,
  useApiQuery,
  type UseApiQueryResult,
} from "@repo/api/query";
import { useAuth } from "@repo/auth";
import { canAccessEmployeeRoster } from "@/lib/employee-roster-access";
import { normalizeOrgChartQuery, orgChartQueryKeys } from "./org-chart-query-keys";
import type { EmployeeOrgChartDto, OrgChartQueryParams } from "./org-chart.types";

const ORG_CHART_PATH = "/corehr/employees/org-chart";

export function useOrgChart(
  query?: OrgChartQueryParams
): UseApiQueryResult<EmployeeOrgChartDto> {
  const { user, isAuthenticated } = useAuth();
  const client = useMemo(() => createPlatformApiClient(), []);
  const canAccess = canAccessEmployeeRoster(user);
  const normalizedQuery = normalizeOrgChartQuery(query);

  const queryFn = useCallback(
    (signal: AbortSignal) =>
      client.get<EmployeeOrgChartDto>(ORG_CHART_PATH, {
        signal,
        params: {
          rootEmployeeId: normalizedQuery.rootEmployeeId ?? undefined,
          maxDepth: normalizedQuery.maxDepth,
          includeInactive: normalizedQuery.includeInactive || undefined,
        },
      }),
    [client, normalizedQuery.includeInactive, normalizedQuery.maxDepth, normalizedQuery.rootEmployeeId]
  );

  return useApiQuery(orgChartQueryKeys.chart(normalizedQuery), queryFn, {
    enabled: isAuthenticated && canAccess,
    placeholderData: keepPreviousData,
  });
}