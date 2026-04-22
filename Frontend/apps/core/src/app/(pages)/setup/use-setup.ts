"use client";

import { useCallback, useMemo } from "react";
import {
  coreSetupQueryKeys,
  coreSetupPaths,
  createPlatformApiClient,
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
      invalidateQueries: [
        { queryKey: coreSetupQueryKeys.readiness(), exact: true },
      ],
      onSuccess: async (data) => {
        queryClient.setQueryData(coreSetupQueryKeys.state(), data);
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
      invalidateQueries: [
        { queryKey: coreSetupQueryKeys.readiness(), exact: true },
      ],
      onSuccess: async (data) => {
        queryClient.setQueryData(coreSetupQueryKeys.state(), data);
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
      invalidateQueries: [
        { queryKey: coreSetupQueryKeys.readiness(), exact: true },
      ],
      onSuccess: async (data) => {
        queryClient.setQueryData(coreSetupQueryKeys.state(), data);
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
      invalidateQueries: [
        { queryKey: coreSetupQueryKeys.readiness(), exact: true },
      ],
      onSuccess: async (data) => {
        queryClient.setQueryData(coreSetupQueryKeys.state(), data);
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
      invalidateQueries: [
        { queryKey: coreSetupQueryKeys.readiness(), exact: true },
      ],
      onSuccess: async (data) => {
        queryClient.setQueryData(coreSetupQueryKeys.state(), data);
        await opts?.onSuccess?.(data);
      },
    }
  );
}
