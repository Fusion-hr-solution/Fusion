"use client";

import { useCallback, useMemo } from "react";
import { coreOrgChartQueryKeys, createCoreOrgChartApi, createPlatformApiClient } from "@repo/api";
import { useApiQuery } from "@repo/api/query";
import { canAccessCoreOrgChart, useAuth } from "@repo/auth";

/** The people org chart as of today, shaped for the viewer by Core HR. */
export function useOrgChart() {
  const { user, isAuthenticated, isLoading } = useAuth();
  const api = useMemo(() => createCoreOrgChartApi(createPlatformApiClient()), []);
  return useApiQuery(
    coreOrgChartQueryKeys.chart(null),
    useCallback((signal) => api.chart(null, signal), [api]),
    { enabled: !isLoading && isAuthenticated && canAccessCoreOrgChart(user) }
  );
}
