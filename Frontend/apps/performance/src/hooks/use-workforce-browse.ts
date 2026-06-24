"use client";

import { useCallback, useMemo } from "react";
import {
  coreWorkforcePaths,
  coreWorkforceQueryKeys,
  createPlatformApiClient,
} from "@repo/api";
import type {
  WorkforceEmployeePageDto,
  WorkforceOrgUnitTreeDto,
} from "@repo/api";
import {
  keepPreviousData,
  useApiQuery,
  type UseApiQueryResult,
} from "@repo/api/query";
import { useAuth } from "@repo/auth";

/**
 * Browse Core org structure and employees to build a cycle population.
 * These read from the Core workforce contract (scope-enforced server-side);
 * Performance never queries Core's database directly.
 */
export function useOrgUnitTree(
  enabled = true
): UseApiQueryResult<WorkforceOrgUnitTreeDto> {
  const { isAuthenticated } = useAuth();
  const client = useMemo(() => createPlatformApiClient(), []);

  const queryFn = useCallback(
    (signal: AbortSignal) =>
      client.get<WorkforceOrgUnitTreeDto>(coreWorkforcePaths.orgUnitTree(), {
        signal,
        params: { maxDepth: 10, includeInactive: false },
      }),
    [client]
  );

  return useApiQuery(
    coreWorkforceQueryKeys.orgUnitTree({ maxDepth: 10, includeInactive: false }),
    queryFn,
    { enabled: isAuthenticated && enabled }
  );
}

export function useEmployeeSearch(
  search: string,
  enabled = true
): UseApiQueryResult<WorkforceEmployeePageDto> {
  const { isAuthenticated } = useAuth();
  const client = useMemo(() => createPlatformApiClient(), []);
  const normalized = search.trim();

  const queryFn = useCallback(
    (signal: AbortSignal) =>
      client.get<WorkforceEmployeePageDto>(coreWorkforcePaths.search(), {
        signal,
        params: { search: normalized || undefined, page: 1, pageSize: 20 },
      }),
    [client, normalized]
  );

  return useApiQuery(
    coreWorkforceQueryKeys.search({ search: normalized || null, page: 1, pageSize: 20 }),
    queryFn,
    { enabled: isAuthenticated && enabled, placeholderData: keepPreviousData }
  );
}
