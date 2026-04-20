"use client";

import { useCallback, useMemo } from "react";
import {
  createPlatformApiClient,
  platformOrganizationsQueryKeys,
  platformOrganizationsPaths,
  type PlatformOrganizationListQueryParams,
  type PlatformOrganizationPagedListDto,
  type PlatformOrganizationDetailDto,
  type PlatformOrganizationCreatedDto,
  type CreatePlatformOrganizationRequest,
  type UpdatePlatformOrganizationRequest,
  type PlatformOrganizationInviteStatusDto,
} from "@repo/api";
import {
  keepPreviousData,
  useApiQuery,
  useApiMutation,
  useApiQueryClient,
  type UseApiQueryResult,
  type UseApiMutationResult,
} from "@repo/api/query";
import { canAccessOrganizations, useAuth } from "@repo/auth";

// ---------------------------------------------------------------------------
// Query params
// ---------------------------------------------------------------------------
export type OrgListParams = PlatformOrganizationListQueryParams;

// ---------------------------------------------------------------------------
// List hook
// ---------------------------------------------------------------------------
export function useOrganizationList(
  params: OrgListParams
): UseApiQueryResult<PlatformOrganizationPagedListDto> {
  const { user, isAuthenticated } = useAuth();
  const client = useMemo(() => createPlatformApiClient(), []);
  const canManageOrganizations = canAccessOrganizations(user);

  const { skip, take, search, orderBy, orderDirection, filterByStatus } =
    params;
  const statusKey = filterByStatus?.join(",") ?? "";

  const queryFn = useCallback(
    (signal: AbortSignal) => {
      const queryParams: Record<string, string | number | boolean | undefined> =
        {
          skip,
          take,
          search: search || undefined,
          orderBy: orderBy || "createdAt",
          orderDirection: orderDirection || "desc",
        };

      // filterByStatus is an array — API expects repeated query params
      // Our client.get appends params as URLSearchParams, so we join them manually
      let path = platformOrganizationsPaths.list();
      const statuses = statusKey ? statusKey.split(",") : [];
      if (statuses.length > 0) {
        const statusParams = statuses
          .map((s) => `filterByStatus=${encodeURIComponent(s)}`)
          .join("&");
        path += `?${statusParams}`;
      }

      return client.get<PlatformOrganizationPagedListDto>(path, {
        signal,
        params: queryParams,
      });
    },
    [client, skip, take, search, orderBy, orderDirection, statusKey]
  );

  return useApiQuery(platformOrganizationsQueryKeys.list(params), queryFn, {
    enabled: isAuthenticated && canManageOrganizations,
    placeholderData: keepPreviousData,
  });
}

// ---------------------------------------------------------------------------
// Detail hook
// ---------------------------------------------------------------------------
export function useOrganizationDetail(
  tenantId: string | null
): UseApiQueryResult<PlatformOrganizationDetailDto> {
  const { user, isAuthenticated } = useAuth();
  const client = useMemo(() => createPlatformApiClient(), []);
  const canManageOrganizations = canAccessOrganizations(user);

  const queryFn = useCallback(
    (signal: AbortSignal) =>
      tenantId
        ? client.get<PlatformOrganizationDetailDto>(
            platformOrganizationsPaths.detail(tenantId),
            { signal }
          )
        : Promise.reject(new Error("tenantId is required")),
    [client, tenantId]
  );

  return useApiQuery(
    platformOrganizationsQueryKeys.detail(tenantId ?? "pending"),
    queryFn,
    {
      enabled: isAuthenticated && canManageOrganizations && !!tenantId,
    }
  );
}

// ---------------------------------------------------------------------------
// Mutations
// ---------------------------------------------------------------------------
export function useCreateOrganization(opts?: {
  onSuccess?: (data: PlatformOrganizationCreatedDto) => void;
}): UseApiMutationResult<
  PlatformOrganizationCreatedDto,
  CreatePlatformOrganizationRequest
> {
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
    {
      invalidateQueries: [{ queryKey: platformOrganizationsQueryKeys.all() }],
      onSuccess: async (data) => {
        await opts?.onSuccess?.(data);
      },
    }
  );
}

export function useUpdateOrganization(
  tenantId: string,
  opts?: { onSuccess?: (data: PlatformOrganizationDetailDto) => void }
): UseApiMutationResult<
  PlatformOrganizationDetailDto,
  UpdatePlatformOrganizationRequest
> {
  const client = useMemo(() => createPlatformApiClient(), []);
  const queryClient = useApiQueryClient();

  return useApiMutation<
    PlatformOrganizationDetailDto,
    UpdatePlatformOrganizationRequest
  >(
    (args) =>
      client.patch<PlatformOrganizationDetailDto>(
        platformOrganizationsPaths.update(tenantId),
        args
      ),
    {
      invalidateQueries: [{ queryKey: platformOrganizationsQueryKeys.lists() }],
      onSuccess: async (data) => {
        queryClient.setQueryData(
          platformOrganizationsQueryKeys.detail(tenantId),
          data
        );
        await opts?.onSuccess?.(data);
      },
    }
  );
}

export function useSuspendOrganization(opts?: {
  onSuccess?: () => void;
}): UseApiMutationResult<boolean, string> {
  const client = useMemo(() => createPlatformApiClient(), []);

  return useApiMutation<boolean, string>(
    (tenantId) =>
      client.post<boolean>(platformOrganizationsPaths.suspend(tenantId)),
    {
      invalidateQueries: [{ queryKey: platformOrganizationsQueryKeys.all() }],
      onSuccess: async () => {
        await opts?.onSuccess?.();
      },
    }
  );
}

export function useReactivateOrganization(opts?: {
  onSuccess?: () => void;
}): UseApiMutationResult<boolean, string> {
  const client = useMemo(() => createPlatformApiClient(), []);

  return useApiMutation<boolean, string>(
    (tenantId) =>
      client.post<boolean>(platformOrganizationsPaths.reactivate(tenantId)),
    {
      invalidateQueries: [{ queryKey: platformOrganizationsQueryKeys.all() }],
      onSuccess: async () => {
        await opts?.onSuccess?.();
      },
    }
  );
}

export function useArchiveOrganization(opts?: {
  onSuccess?: () => void;
}): UseApiMutationResult<boolean, string> {
  const client = useMemo(() => createPlatformApiClient(), []);

  return useApiMutation<boolean, string>(
    (tenantId) =>
      client.post<boolean>(platformOrganizationsPaths.archive(tenantId)),
    {
      invalidateQueries: [{ queryKey: platformOrganizationsQueryKeys.all() }],
      onSuccess: async () => {
        await opts?.onSuccess?.();
      },
    }
  );
}

export function useResendFirstAdminInvite(opts?: {
  onSuccess?: (data: PlatformOrganizationInviteStatusDto) => void;
}): UseApiMutationResult<PlatformOrganizationInviteStatusDto, string> {
  const client = useMemo(() => createPlatformApiClient(), []);

  return useApiMutation<PlatformOrganizationInviteStatusDto, string>(
    (tenantId) =>
      client.post<PlatformOrganizationInviteStatusDto>(
        platformOrganizationsPaths.resendFirstAdmin(tenantId)
      ),
    {
      invalidateQueries: [{ queryKey: platformOrganizationsQueryKeys.all() }],
      onSuccess: async (data) => {
        await opts?.onSuccess?.(data);
      },
    }
  );
}

export function useRevokeFirstAdminInvite(opts?: {
  onSuccess?: () => void;
}): UseApiMutationResult<boolean, string> {
  const client = useMemo(() => createPlatformApiClient(), []);

  return useApiMutation<boolean, string>(
    (tenantId) =>
      client.post<boolean>(
        platformOrganizationsPaths.revokeFirstAdmin(tenantId)
      ),
    {
      invalidateQueries: [{ queryKey: platformOrganizationsQueryKeys.all() }],
      onSuccess: async () => {
        await opts?.onSuccess?.();
      },
    }
  );
}
