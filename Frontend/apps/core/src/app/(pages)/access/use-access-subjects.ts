"use client";

import { useCallback, useMemo } from "react";
import {
  coreWorkforcePaths,
  coreWorkforceQueryKeys,
  createPlatformApiClient,
  type WorkforceAccessRosterSummaryDto,
  type WorkforceAccessSubjectPageDto,
} from "@repo/api";
import { useApiQuery } from "@repo/api/query";
import { useAuth } from "@repo/auth";

export interface AccessSubjectQueryParams {
  search?: string | null;
  page: number;
  pageSize: number;
}

export function useAccessSubjects(
  params: AccessSubjectQueryParams,
  enabled = true
) {
  const { isAuthenticated } = useAuth();
  const client = useMemo(() => createPlatformApiClient(), []);

  const queryFn = useCallback(
    (signal: AbortSignal) =>
      client.get<WorkforceAccessSubjectPageDto>(
        coreWorkforcePaths.accessSubjects(),
        {
          signal,
          params: {
            search: params.search?.trim() || undefined,
            page: params.page,
            pageSize: params.pageSize,
          },
        }
      ),
    [client, params.page, params.pageSize, params.search]
  );

  return useApiQuery(coreWorkforceQueryKeys.accessSubjects(params), queryFn, {
    enabled: isAuthenticated && enabled,
  });
}

export function useAccessSubjectSummary(enabled = true) {
  const { isAuthenticated } = useAuth();
  const client = useMemo(() => createPlatformApiClient(), []);

  const queryFn = useCallback(
    (signal: AbortSignal) =>
      client.get<WorkforceAccessRosterSummaryDto>(
        coreWorkforcePaths.accessSubjectsSummary(),
        {
          signal,
        }
      ),
    [client]
  );

  return useApiQuery(
    coreWorkforceQueryKeys.accessSubjectsSummary(),
    queryFn,
    {
      enabled: isAuthenticated && enabled,
    }
  );
}