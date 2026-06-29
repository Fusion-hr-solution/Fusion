"use client";

import { useCallback, useMemo } from "react";
import {
  coreWorkforcePaths,
  coreWorkforceQueryKeys,
  createPlatformApiClient,
  type WorkforceAccessRosterSummaryDto,
  type WorkforceAccessState,
  type WorkforceAccessSubjectPageDto,
  type WorkforceAccessSubjectSummaryDto,
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

export interface AccessSubjectSelectionPreviewParams {
  search?: string | null;
  access?: WorkforceAccessState | null;
  profileId?: string | null;
  employeeStatus?: "Active" | "Inactive" | null;
  employeeKey?: string | null;
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

export function useAccessSubjectSelectionPreview(
  params: AccessSubjectSelectionPreviewParams,
  enabled = true
) {
  const { isAuthenticated } = useAuth();
  const client = useMemo(() => createPlatformApiClient(), []);

  const queryFn = useCallback(
    (signal: AbortSignal) =>
      client.get<WorkforceAccessSubjectSummaryDto[]>(
        coreWorkforcePaths.accessSubjectsPreview(),
        {
          signal,
          params: {
            search: params.search?.trim() || undefined,
            access: params.access || undefined,
            profileId: params.profileId || undefined,
            employeeStatus: params.employeeStatus || undefined,
            employeeKey: params.employeeKey?.trim() || undefined,
          },
        }
      ),
    [
      client,
      params.access,
      params.employeeKey,
      params.employeeStatus,
      params.profileId,
      params.search,
    ]
  );

  return useApiQuery(
    coreWorkforceQueryKeys.accessSubjectsPreview(params),
    queryFn,
    {
      enabled: isAuthenticated && enabled,
    }
  );
}
