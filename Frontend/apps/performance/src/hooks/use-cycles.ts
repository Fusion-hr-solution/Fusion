"use client";

import { useCallback, useMemo } from "react";
import { createPlatformApiClient, performancePaths, performanceQueryKeys } from "@repo/api";
import type {
  CreatePerformanceCycleRequest,
  CycleAuditEventDto,
  CyclePopulationPreviewDto,
  CycleParticipantDto,
  PerformanceCycleDetailDto,
  PerformanceCycleSummaryDto,
  PerformancePageDto,
  SetCyclePopulationRequest,
  UpdatePerformanceCycleRequest,
} from "@repo/api";
import {
  keepPreviousData,
  useApiMutation,
  useApiQuery,
  type UseApiQueryResult,
} from "@repo/api/query";
import { useAuth } from "@repo/auth";

interface CycleListParams {
  search?: string | null;
  status?: string | null;
  type?: string | null;
  page: number;
  pageSize: number;
}

const ifMatch = (version: number) => ({ headers: { "If-Match": `"${version}"` } });

export function usePerformanceCycles(
  params: CycleListParams,
  enabled = true
): UseApiQueryResult<PerformancePageDto<PerformanceCycleSummaryDto>> {
  const { isAuthenticated } = useAuth();
  const client = useMemo(() => createPlatformApiClient(), []);

  const queryFn = useCallback(
    (signal: AbortSignal) =>
      client.get<PerformancePageDto<PerformanceCycleSummaryDto>>(performancePaths.cycles(), {
        signal,
        params: {
          search: params.search?.trim() || undefined,
          status: params.status || undefined,
          type: params.type || undefined,
          page: params.page,
          pageSize: params.pageSize,
        },
      }),
    [client, params.search, params.status, params.type, params.page, params.pageSize]
  );

  return useApiQuery(performanceQueryKeys.cycleList(params), queryFn, {
    enabled: isAuthenticated && enabled,
    placeholderData: keepPreviousData,
  });
}

export function usePerformanceCycle(
  cycleId: string | null,
  enabled = true
): UseApiQueryResult<PerformanceCycleDetailDto> {
  const { isAuthenticated } = useAuth();
  const client = useMemo(() => createPlatformApiClient(), []);

  const queryFn = useCallback(
    (signal: AbortSignal) => {
      if (!cycleId) throw new Error("Cycle id is required.");
      return client.get<PerformanceCycleDetailDto>(performancePaths.cycle(cycleId), { signal });
    },
    [client, cycleId]
  );

  return useApiQuery(performanceQueryKeys.cycle(cycleId ?? "pending"), queryFn, {
    enabled: isAuthenticated && enabled && !!cycleId,
  });
}

export function useCycleParticipants(
  cycleId: string | null,
  params: { search?: string | null; page: number; pageSize: number },
  enabled = true
): UseApiQueryResult<PerformancePageDto<CycleParticipantDto>> {
  const { isAuthenticated } = useAuth();
  const client = useMemo(() => createPlatformApiClient(), []);

  const queryFn = useCallback(
    (signal: AbortSignal) => {
      if (!cycleId) throw new Error("Cycle id is required.");
      return client.get<PerformancePageDto<CycleParticipantDto>>(
        performancePaths.cycleParticipants(cycleId),
        {
          signal,
          params: {
            search: params.search?.trim() || undefined,
            page: params.page,
            pageSize: params.pageSize,
          },
        }
      );
    },
    [client, cycleId, params.search, params.page, params.pageSize]
  );

  return useApiQuery(
    performanceQueryKeys.cycleParticipants(cycleId ?? "pending", params),
    queryFn,
    {
      enabled: isAuthenticated && enabled && !!cycleId,
      placeholderData: keepPreviousData,
    }
  );
}

export function useCycleAudit(
  cycleId: string | null,
  enabled = true
): UseApiQueryResult<CycleAuditEventDto[]> {
  const { isAuthenticated } = useAuth();
  const client = useMemo(() => createPlatformApiClient(), []);

  const queryFn = useCallback(
    (signal: AbortSignal) => {
      if (!cycleId) throw new Error("Cycle id is required.");
      return client.get<CycleAuditEventDto[]>(performancePaths.cycleAudit(cycleId), { signal });
    },
    [client, cycleId]
  );

  return useApiQuery(performanceQueryKeys.cycleAudit(cycleId ?? "pending"), queryFn, {
    enabled: isAuthenticated && enabled && !!cycleId,
  });
}

export function useCyclePopulationPreview(
  cycleId: string | null,
  enabled = true
): UseApiQueryResult<CyclePopulationPreviewDto> {
  const { isAuthenticated } = useAuth();
  const client = useMemo(() => createPlatformApiClient(), []);

  const queryFn = useCallback(
    (signal: AbortSignal) => {
      if (!cycleId) throw new Error("Cycle id is required.");
      return client.get<CyclePopulationPreviewDto>(
        performancePaths.cyclePopulationPreview(cycleId),
        { signal }
      );
    },
    [client, cycleId]
  );

  return useApiQuery(performanceQueryKeys.cyclePopulationPreview(cycleId ?? "pending"), queryFn, {
    enabled: isAuthenticated && enabled && !!cycleId,
  });
}

export function useCreateCycle() {
  const client = useMemo(() => createPlatformApiClient(), []);
  return useApiMutation<PerformanceCycleDetailDto, CreatePerformanceCycleRequest>(
    (body) => client.post<PerformanceCycleDetailDto>(performancePaths.cycles(), body),
    { invalidateQueries: [{ queryKey: performanceQueryKeys.cycles() }] }
  );
}

export function useUpdateCycle(cycleId: string) {
  const client = useMemo(() => createPlatformApiClient(), []);
  return useApiMutation<
    PerformanceCycleDetailDto,
    { version: number; body: UpdatePerformanceCycleRequest }
  >(
    ({ version, body }) =>
      client.put<PerformanceCycleDetailDto>(performancePaths.cycle(cycleId), body, ifMatch(version)),
    { invalidateQueries: [{ queryKey: performanceQueryKeys.cycles() }] }
  );
}

export function useDeleteCycle() {
  const client = useMemo(() => createPlatformApiClient(), []);
  return useApiMutation<void, { cycleId: string; version: number }>(
    ({ cycleId, version }) =>
      client.delete<void>(performancePaths.cycle(cycleId), ifMatch(version)),
    { invalidateQueries: [{ queryKey: performanceQueryKeys.cycles() }] }
  );
}

export function useSetCyclePopulation(cycleId: string) {
  const client = useMemo(() => createPlatformApiClient(), []);
  return useApiMutation<
    PerformanceCycleDetailDto,
    { version: number; body: SetCyclePopulationRequest }
  >(
    ({ version, body }) =>
      client.put<PerformanceCycleDetailDto>(
        performancePaths.cyclePopulation(cycleId),
        body,
        ifMatch(version)
      ),
    { invalidateQueries: [{ queryKey: performanceQueryKeys.cycle(cycleId) }] }
  );
}

type TransitionKind = "publish" | "activate" | "close";

export function useCycleTransition(cycleId: string) {
  const client = useMemo(() => createPlatformApiClient(), []);
  const pathFor = (kind: TransitionKind) =>
    kind === "publish"
      ? performancePaths.cyclePublish(cycleId)
      : kind === "activate"
        ? performancePaths.cycleActivate(cycleId)
        : performancePaths.cycleClose(cycleId);

  return useApiMutation<
    PerformanceCycleDetailDto,
    { kind: TransitionKind; version: number }
  >(
    ({ kind, version }) =>
      client.post<PerformanceCycleDetailDto>(pathFor(kind), undefined, ifMatch(version)),
    { invalidateQueries: [{ queryKey: performanceQueryKeys.cycles() }] }
  );
}
