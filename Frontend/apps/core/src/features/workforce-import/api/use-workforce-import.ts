"use client";

import { useCallback, useMemo } from "react";
import {
  coreWorkforceImportQueryKeys,
  createCoreWorkforceImportApi,
  createPlatformApiClient,
  type WorkforceApplyStatusDto,
} from "@repo/api";
import { keepPreviousData, useApiQuery } from "@repo/api/query";
import { canImportCoreEmployees, useAuth } from "@repo/auth";

export function useWorkforceImportApi() {
  const client = useMemo(() => createPlatformApiClient(), []);
  return useMemo(() => createCoreWorkforceImportApi(client), [client]);
}

/** The single active import for the tenant (resume strip), if any. */
export function useActiveWorkforceImport() {
  const api = useWorkforceImportApi();
  const { user, isAuthenticated, isLoading } = useAuth();
  const enabled = !isLoading && isAuthenticated && canImportCoreEmployees(user);
  return useApiQuery(
    coreWorkforceImportQueryKeys.active(),
    useCallback((signal) => api.active(signal), [api]),
    { enabled, staleTime: 0 }
  );
}

export function useWorkforceImportSession(sessionId: string | null) {
  const api = useWorkforceImportApi();
  const { isAuthenticated, isLoading } = useAuth();
  return useApiQuery(
    coreWorkforceImportQueryKeys.session(sessionId ?? "none"),
    useCallback((signal) => api.session(sessionId!, signal), [api, sessionId]),
    { enabled: !isLoading && isAuthenticated && Boolean(sessionId) }
  );
}

export function useWorkforceReview(
  sessionId: string | null,
  params: { filter: string; query: string; page: number; pageSize: number }
) {
  const api = useWorkforceImportApi();
  const { isAuthenticated, isLoading } = useAuth();
  return useApiQuery(
    coreWorkforceImportQueryKeys.review(sessionId ?? "none", params.filter, params.query, params.page),
    useCallback(
      (signal) =>
        api.review(sessionId!, { filter: params.filter || undefined, query: params.query || undefined, page: params.page, pageSize: params.pageSize }, signal),
      [api, sessionId, params.filter, params.query, params.page, params.pageSize]
    ),
    { enabled: !isLoading && isAuthenticated && Boolean(sessionId), placeholderData: keepPreviousData }
  );
}

/** Poll the Apply operation while it is in flight; stop once terminal. */
export function useWorkforceApplyStatus(sessionId: string | null, active: boolean) {
  const api = useWorkforceImportApi();
  return useApiQuery<WorkforceApplyStatusDto>(
    coreWorkforceImportQueryKeys.commit(sessionId ?? "none"),
    useCallback((signal) => api.commitStatus(sessionId!, signal), [api, sessionId]),
    {
      enabled: Boolean(sessionId) && active,
      refetchInterval: (query) => {
        const status = query.state.data?.status;
        return status === "Queued" || status === "Running" ? 900 : false;
      },
    }
  );
}
