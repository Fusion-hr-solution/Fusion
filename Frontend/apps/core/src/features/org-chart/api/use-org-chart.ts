"use client";

import { useCallback, useMemo } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { coreOrgChartQueryKeys, createCoreOrgChartApi, createPlatformApiClient } from "@repo/api";
import { keepPreviousData, useApiQuery } from "@repo/api/query";
import { canAccessCoreOrgChart, useAuth } from "@repo/auth";

function useOrgChartApi() {
  return useMemo(() => createCoreOrgChartApi(createPlatformApiClient()), []);
}

/**
 * The people org chart as of a date (null = today), shaped for the viewer by Core HR. Moving the date keeps the
 * previous chart on screen until the next one arrives, so cards move instead of the stage flashing a skeleton.
 */
export function useOrgChart(asOf: string | null = null) {
  const { user, isAuthenticated, isLoading } = useAuth();
  const api = useOrgChartApi();
  return useApiQuery(
    coreOrgChartQueryKeys.chart(asOf),
    useCallback((signal) => api.chart(asOf, signal), [api, asOf]),
    { enabled: !isLoading && isAuthenticated && canAccessCoreOrgChart(user), placeholderData: keepPreviousData }
  );
}

/** Joins, leavers and moves between two days, both included (HR). */
export function useOrgChartChanges(from: string, to: string, enabled: boolean) {
  const api = useOrgChartApi();
  return useApiQuery(
    coreOrgChartQueryKeys.changes(from, to),
    useCallback((signal) => api.changes(from, to, signal), [api, from, to]),
    { enabled: enabled && from <= to, placeholderData: keepPreviousData }
  );
}

/** Loads the chart for a date ahead of showing it: Replay steps through dates without waiting on each. */
export function usePrefetchOrgChart() {
  const queryClient = useQueryClient();
  const api = useOrgChartApi();
  return useCallback(
    (asOf: string) =>
      queryClient.fetchQuery({
        queryKey: coreOrgChartQueryKeys.chart(asOf),
        queryFn: ({ signal }) => api.chart(asOf, signal),
        staleTime: 60_000,
      }),
    [queryClient, api]
  );
}
