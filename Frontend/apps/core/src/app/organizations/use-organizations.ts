"use client";

import { useCallback, useMemo } from "react";
import {
  createPlatformApiClient,
  platformOrganizationsPaths,
  type PlatformOrganizationPagedListDto,
  type PlatformOrganizationDetailDto,
  type PlatformOrganizationCreatedDto,
  type CreatePlatformOrganizationRequest,
  type UpdatePlatformOrganizationRequest,
  type PlatformOrganizationInviteStatusDto,
} from "@repo/api";
import { useApiQuery, useApiMutation, type UseApiQueryResult, type UseApiMutationResult } from "@repo/api/react";
import { useAuth } from "@repo/auth";

// ---------------------------------------------------------------------------
// Query params
// ---------------------------------------------------------------------------
export interface OrgListParams {
  skip: number;
  take: number;
  search?: string;
  orderBy?: string;
  orderDirection?: string;
  filterByStatus?: string[];
  filterNeedsAttention?: boolean;
}

// ---------------------------------------------------------------------------
// List hook
// ---------------------------------------------------------------------------
export function useOrganizationList(params: OrgListParams): UseApiQueryResult<PlatformOrganizationPagedListDto> {
  const { isAuthenticated } = useAuth();
  const client = useMemo(() => createPlatformApiClient(), []);

  const queryFn = useCallback(
    (signal: AbortSignal) => {
      const queryParams: Record<string, string | number | boolean | undefined> =
        {
          skip: params.skip,
          take: params.take,
          search: params.search || undefined,
          orderBy: params.orderBy || "createdAt",
          orderDirection: params.orderDirection || "desc",
          filterNeedsAttention: params.filterNeedsAttention ?? undefined,
        };

      // filterByStatus is an array — API expects repeated query params
      // Our client.get appends params as URLSearchParams, so we join them manually
      let path = platformOrganizationsPaths.list();
      if (params.filterByStatus && params.filterByStatus.length > 0) {
        const statusParams = params.filterByStatus
          .map((s) => `filterByStatus=${encodeURIComponent(s)}`)
          .join("&");
        path += `?${statusParams}`;
      }

      return client.get<PlatformOrganizationPagedListDto>(path, {
        signal,
        params: queryParams,
      });
    },
    [client, params]
  );

  return useApiQuery(queryFn, { enabled: isAuthenticated });
}

// ---------------------------------------------------------------------------
// Detail hook
// ---------------------------------------------------------------------------
export function useOrganizationDetail(tenantId: string | null): UseApiQueryResult<PlatformOrganizationDetailDto> {
  const { isAuthenticated } = useAuth();
  const client = useMemo(() => createPlatformApiClient(), []);

  const queryFn = useCallback(
    (signal: AbortSignal) =>
      client.get<PlatformOrganizationDetailDto>(
        platformOrganizationsPaths.detail(tenantId!),
        { signal }
      ),
    [client, tenantId]
  );

  return useApiQuery(queryFn, { enabled: isAuthenticated && !!tenantId });
}

// ---------------------------------------------------------------------------
// Mutations
// ---------------------------------------------------------------------------
export function useCreateOrganization(
  opts?: { onSuccess?: (data: PlatformOrganizationCreatedDto) => void }
): UseApiMutationResult<PlatformOrganizationCreatedDto, CreatePlatformOrganizationRequest> {
  const client = useMemo(() => createPlatformApiClient(), []);

  return useApiMutation<
    PlatformOrganizationCreatedDto,
    CreatePlatformOrganizationRequest
  >(
    (args) =>
      client.post<PlatformOrganizationCreatedDto>(
        platformOrganizationsPaths.create(),
        args
      ),
    opts
  );
}

export function useUpdateOrganization(
  tenantId: string,
  opts?: { onSuccess?: (data: PlatformOrganizationDetailDto) => void }
): UseApiMutationResult<PlatformOrganizationDetailDto, UpdatePlatformOrganizationRequest> {
  const client = useMemo(() => createPlatformApiClient(), []);

  return useApiMutation<
    PlatformOrganizationDetailDto,
    UpdatePlatformOrganizationRequest
  >(
    (args) =>
      client.patch<PlatformOrganizationDetailDto>(
        platformOrganizationsPaths.update(tenantId),
        args
      ),
    opts
  );
}

export function useSuspendOrganization(
  opts?: { onSuccess?: () => void }
): UseApiMutationResult<boolean, string> {
  const client = useMemo(() => createPlatformApiClient(), []);

  return useApiMutation<boolean, string>(
    (tenantId) =>
      client.post<boolean>(platformOrganizationsPaths.suspend(tenantId)),
    opts
  );
}

export function useReactivateOrganization(
  opts?: { onSuccess?: () => void }
): UseApiMutationResult<boolean, string> {
  const client = useMemo(() => createPlatformApiClient(), []);

  return useApiMutation<boolean, string>(
    (tenantId) =>
      client.post<boolean>(platformOrganizationsPaths.reactivate(tenantId)),
    opts
  );
}

export function useArchiveOrganization(
  opts?: { onSuccess?: () => void }
): UseApiMutationResult<boolean, string> {
  const client = useMemo(() => createPlatformApiClient(), []);

  return useApiMutation<boolean, string>(
    (tenantId) =>
      client.post<boolean>(platformOrganizationsPaths.archive(tenantId)),
    opts
  );
}

export function useResendFirstAdminInvite(
  opts?: { onSuccess?: (data: PlatformOrganizationInviteStatusDto) => void }
): UseApiMutationResult<PlatformOrganizationInviteStatusDto, string> {
  const client = useMemo(() => createPlatformApiClient(), []);

  return useApiMutation<PlatformOrganizationInviteStatusDto, string>(
    (tenantId) =>
      client.post<PlatformOrganizationInviteStatusDto>(
        platformOrganizationsPaths.resendFirstAdmin(tenantId)
      ),
    opts
  );
}

export function useRevokeFirstAdminInvite(
  opts?: { onSuccess?: () => void }
): UseApiMutationResult<boolean, string> {
  const client = useMemo(() => createPlatformApiClient(), []);

  return useApiMutation<boolean, string>(
    (tenantId) =>
      client.post<boolean>(
        platformOrganizationsPaths.revokeFirstAdmin(tenantId)
      ),
    opts
  );
}
