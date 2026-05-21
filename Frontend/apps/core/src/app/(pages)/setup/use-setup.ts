"use client";

import { useCallback, useMemo } from "react";
import {
  coreWorkforceQueryKeys,
  coreSetupQueryKeys,
  coreSetupPaths,
  createPlatformApiClient,
  draftStructureQueryKeys,
  tenantSettingsQueryKeys,
  type DraftSetupReadinessDto,
  type TenantSetupStateDto,
} from "@repo/api";
import {
  useApiMutation,
  useApiQuery,
  useApiQueryClient,
} from "@repo/api/query";
import { useAuth } from "@repo/auth";

interface VersionedSetupMutationArgs {
  expectedVersion: number;
}

async function invalidateSetupLifecycleQueries(
  queryClient: ReturnType<typeof useApiQueryClient>,
  options?: { includePublishedSurfaces?: boolean }
) {
  const invalidations = [
    queryClient.invalidateQueries({ queryKey: coreSetupQueryKeys.all() }),
    queryClient.invalidateQueries({ queryKey: draftStructureQueryKeys.all() }),
  ];

  if (options?.includePublishedSurfaces) {
    invalidations.push(
      queryClient.invalidateQueries({
        queryKey: tenantSettingsQueryKeys.all(),
      }),
      queryClient.invalidateQueries({ queryKey: coreWorkforceQueryKeys.all() })
    );
  }

  await Promise.all(invalidations);
}

export function useSetupState(enabled = true) {
  const { isAuthenticated } = useAuth();
  const client = useMemo(() => createPlatformApiClient(), []);

  const queryFn = useCallback(
    (signal: AbortSignal) =>
      client.get<TenantSetupStateDto>(coreSetupPaths.state(), { signal }),
    [client]
  );

  return useApiQuery(coreSetupQueryKeys.state(), queryFn, {
    enabled: isAuthenticated && enabled,
  });
}

export function useActivateSetup(opts?: {
  onSuccess?: (data: TenantSetupStateDto) => void;
}) {
  const client = useMemo(() => createPlatformApiClient(), []);
  const queryClient = useApiQueryClient();

  return useApiMutation<TenantSetupStateDto, void>(
    () => client.post<TenantSetupStateDto>(coreSetupPaths.activate()),
    {
      onSuccess: async (data) => {
        queryClient.setQueryData(coreSetupQueryKeys.state(), data);
        await invalidateSetupLifecycleQueries(queryClient);
        await opts?.onSuccess?.(data);
      },
    }
  );
}

export function useSetupReadiness(enabled = true) {
  const { isAuthenticated } = useAuth();
  const client = useMemo(() => createPlatformApiClient(), []);

  const queryFn = useCallback(
    (signal: AbortSignal) =>
      client.get<DraftSetupReadinessDto>(coreSetupPaths.readiness(), {
        signal,
      }),
    [client]
  );

  return useApiQuery(coreSetupQueryKeys.readiness(), queryFn, {
    enabled: isAuthenticated && enabled,
  });
}

export function useApproveStructure(opts?: {
  onSuccess?: (data: TenantSetupStateDto) => void;
}) {
  const client = useMemo(() => createPlatformApiClient(), []);
  const queryClient = useApiQueryClient();

  return useApiMutation<TenantSetupStateDto, VersionedSetupMutationArgs>(
    ({ expectedVersion }) =>
      client.post<TenantSetupStateDto>(coreSetupPaths.approve(), undefined, {
        headers: { "If-Match": `"${expectedVersion}"` },
      }),
    {
      onSuccess: async (data) => {
        queryClient.setQueryData(coreSetupQueryKeys.state(), data);
        await invalidateSetupLifecycleQueries(queryClient);
        await opts?.onSuccess?.(data);
      },
    }
  );
}

export function useReopenStructure(opts?: {
  onSuccess?: (data: TenantSetupStateDto) => void;
}) {
  const client = useMemo(() => createPlatformApiClient(), []);
  const queryClient = useApiQueryClient();

  return useApiMutation<TenantSetupStateDto, VersionedSetupMutationArgs>(
    ({ expectedVersion }) =>
      client.post<TenantSetupStateDto>(coreSetupPaths.reopen(), undefined, {
        headers: { "If-Match": `"${expectedVersion}"` },
      }),
    {
      onSuccess: async (data) => {
        queryClient.setQueryData(coreSetupQueryKeys.state(), data);
        await invalidateSetupLifecycleQueries(queryClient);
        await opts?.onSuccess?.(data);
      },
    }
  );
}

export function usePublishStructure(opts?: {
  onSuccess?: (data: TenantSetupStateDto) => void;
}) {
  const client = useMemo(() => createPlatformApiClient(), []);
  const queryClient = useApiQueryClient();

  return useApiMutation<TenantSetupStateDto, VersionedSetupMutationArgs>(
    ({ expectedVersion }) =>
      client.post<TenantSetupStateDto>(coreSetupPaths.publish(), undefined, {
        headers: { "If-Match": `"${expectedVersion}"` },
      }),
    {
      onSuccess: async (data) => {
        queryClient.setQueryData(coreSetupQueryKeys.state(), data);
        await invalidateSetupLifecycleQueries(queryClient, {
          includePublishedSurfaces: true,
        });
        await opts?.onSuccess?.(data);
      },
    }
  );
}

export function useCompleteSetup(opts?: {
  onSuccess?: (data: TenantSetupStateDto) => void;
}) {
  const client = useMemo(() => createPlatformApiClient(), []);
  const queryClient = useApiQueryClient();

  return useApiMutation<TenantSetupStateDto, VersionedSetupMutationArgs>(
    ({ expectedVersion }) =>
      client.post<TenantSetupStateDto>(coreSetupPaths.complete(), undefined, {
        headers: { "If-Match": `"${expectedVersion}"` },
      }),
    {
      onSuccess: async (data) => {
        queryClient.setQueryData(coreSetupQueryKeys.state(), data);
        await invalidateSetupLifecycleQueries(queryClient, {
          includePublishedSurfaces: true,
        });
        await opts?.onSuccess?.(data);
      },
    }
  );
}
