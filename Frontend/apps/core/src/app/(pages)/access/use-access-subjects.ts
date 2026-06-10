"use client";

import { useCallback, useMemo } from "react";
import {
  coreWorkforcePaths,
  coreWorkforceQueryKeys,
  createPlatformApiClient,
  type WorkforceAccessRosterSummaryDto,
  type WorkforceAccessState,
  type WorkforceAccessSubjectPageDto,
} from "@repo/api";
import { useApiQuery } from "@repo/api/query";
import { useAuth } from "@repo/auth";

export interface AccessSubjectQueryParams {
  search?: string | null;
  access?: WorkforceAccessState | null;
  profileId?: string | null;
  employeeStatus?: "Active" | "Inactive" | null;
  employeeKey?: string | null;
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
            access: params.access || undefined,
            profileId: params.profileId || undefined,
            employeeStatus: params.employeeStatus || undefined,
            employeeKey: params.employeeKey?.trim() || undefined,
            page: params.page,
            pageSize: params.pageSize,
          },
        }
      ),
    [
      client,
      params.access,
      params.employeeKey,
      params.employeeStatus,
      params.page,
      params.pageSize,
      params.profileId,
      params.search,
    ]
  );

  return useApiQuery(coreWorkforceQueryKeys.accessSubjects(params as Parameters<typeof coreWorkforceQueryKeys.accessSubjects>[0]), queryFn, {
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
