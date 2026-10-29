"use client";

import { useCallback, useMemo } from "react";
import { useQueries, useQueryClient, type UseQueryResult } from "@tanstack/react-query";
import { coreOrgChartQueryKeys, createCoreOrgChartApi, createPlatformApiClient, createReviewsApi, reviewQueryKeys, type OpenRoleRequest, type OrgChartDto } from "@repo/api";
import { keepPreviousData, useApiMutation, useApiQuery } from "@repo/api/query";
import { useAuth } from "@repo/auth";
import { useOrgChartAccess } from "./use-org-chart-access";

function useOrgChartApi() {
  return useMemo(() => createCoreOrgChartApi(createPlatformApiClient()), []);
}

/**
 * The people org chart as of a date (null = today), shaped for the viewer by Core HR. Moving the date keeps the
 * previous chart on screen until the next one arrives, so cards move instead of the stage flashing a skeleton.
 */
export function useOrgChart(asOf: string | null = null) {
  const { isAuthenticated } = useAuth();
  const access = useOrgChartAccess();
  const api = useOrgChartApi();
  return useApiQuery(
    coreOrgChartQueryKeys.chart(asOf),
    useCallback((signal) => api.chart(asOf, signal), [api, asOf]),
    { enabled: !access.isLoading && isAuthenticated && access.canSee, placeholderData: keepPreviousData }
  );
}

export type BranchStatus = "loading" | "ready" | "failed";

const combineBranches = (results: UseQueryResult<OrgChartDto>[]) => ({
  windows: results.flatMap((result) => (result.data ? [result.data] : [])),
  status: results.map((result): BranchStatus => (result.data ? "ready" : result.isError ? "failed" : "loading")),
});

/**
 * The branches opened on a windowed chart (above 3,000 people): the window rooted at each, for the chart's date.
 * They refresh with the chart, so a change saved elsewhere reaches loaded branches too.
 */
export function useOrgChartBranches(asOf: string | null, roots: string[]) {
  const api = useOrgChartApi();
  return useQueries({
    queries: roots.map((root) => ({
      queryKey: coreOrgChartQueryKeys.branch(asOf, root),
      queryFn: ({ signal }: { signal: AbortSignal }) => api.branch(asOf, root, signal),
      staleTime: 60_000,
      retry: false,
    })),
    combine: combineBranches,
  });
}

/** People on the chart matching the text, from Core HR: a windowed chart doesn't hold everyone to search. */
export function useOrgChartSearch(asOf: string | null, query: string, enabled: boolean) {
  const api = useOrgChartApi();
  return useApiQuery(
    coreOrgChartQueryKeys.search(asOf, query),
    useCallback((signal) => api.search(asOf, query, signal), [api, asOf, query]),
    { enabled: enabled && query.length > 0, placeholderData: keepPreviousData }
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

/** Today's review progress from Performance, for the Review progress lens: only the reviews the viewer may read there. */
export function useReviewProgress(enabled: boolean) {
  const api = useMemo(() => createReviewsApi(createPlatformApiClient()), []);
  return useApiQuery(reviewQueryKeys.progress(), useCallback((signal) => api.getProgress(signal), [api]), { enabled });
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

/** Add and edit open roles (people admins); the chart refreshes after each. */
export function useOpenRoleMutations() {
  const queryClient = useQueryClient();
  const api = useOrgChartApi();
  const onSuccess = useCallback(() => void queryClient.invalidateQueries({ queryKey: coreOrgChartQueryKeys.all() }), [queryClient]);
  return {
    create: useApiMutation((request: OpenRoleRequest) => api.createOpenRole(request), { onSuccess }),
    update: useApiMutation(({ id, request }: { id: string; request: OpenRoleRequest }) => api.updateOpenRole(id, request), { onSuccess }),
  };
}
