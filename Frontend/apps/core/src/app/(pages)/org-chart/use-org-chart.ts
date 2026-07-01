"use client";

import { useCallback, useMemo } from "react";
import { createPlatformApiClient } from "@repo/api";
import {
  keepPreviousData,
  useApiQuery,
  type UseApiQueryResult,
} from "@repo/api/query";
import { canAccessCoreOrgChart, useAuth } from "@repo/auth";
import { useTenantContext } from "@/shell/tenant-context/core-tenant-context-provider";
import { normalizeOrgChartQuery, orgChartQueryKeys } from "./org-chart-query-keys";
import type { EmployeeOrgChartDto, OrgChartQueryParams } from "./org-chart.types";

const ORG_CHART_PATH = "/corehr/employees/org-chart";

export function useOrgChart(
  query?: OrgChartQueryParams,
  enabled = true
): UseApiQueryResult<EmployeeOrgChartDto> {
  const { user, isAuthenticated } = useAuth();
  const { tenantId } = useTenantContext();
  const client = useMemo(() => createPlatformApiClient(), []);
  const canAccess =
    canAccessCoreOrgChart(user) ||
    (!!user?.roles.includes("PlatformAdmin") && !!tenantId);
  const normalizedQuery = normalizeOrgChartQuery(query);

  const queryFn = useCallback(
    (signal: AbortSignal) =>
      client.get<EmployeeOrgChartDto>(ORG_CHART_PATH, {
        signal,
        params: {
          rootEmployeeId: normalizedQuery.rootEmployeeId ?? undefined,
          focusEmployeeId: normalizedQuery.focusEmployeeId ?? undefined,
          rootEmployeeKey: normalizedQuery.rootEmployeeKey ?? undefined,
          focusEmployeeKey: normalizedQuery.focusEmployeeKey ?? undefined,
          orgUnitId: normalizedQuery.orgUnitId ?? undefined,
          orgUnitCode: normalizedQuery.orgUnitCode ?? undefined,
          maxDepth: normalizedQuery.maxDepth,
          includeInactive: normalizedQuery.includeInactive || undefined,
        },
      }),
    [
      client,
      normalizedQuery.focusEmployeeId,
      normalizedQuery.focusEmployeeKey,
      normalizedQuery.includeInactive,
      normalizedQuery.maxDepth,
      normalizedQuery.orgUnitCode,
      normalizedQuery.orgUnitId,
      normalizedQuery.rootEmployeeId,
      normalizedQuery.rootEmployeeKey,
    ]
  );

  return useApiQuery(orgChartQueryKeys.chart(normalizedQuery), queryFn, {
    enabled: isAuthenticated && canAccess && enabled,
    placeholderData: keepPreviousData,
  });
}
