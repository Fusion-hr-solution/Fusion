"use client";

import { useCallback, useMemo } from "react";
import {
  coreSetupPaths,
  createPlatformApiClient,
  type DraftSetupReadinessDto,
  type TenantSetupStateDto,
} from "@repo/api";
import { useApiMutation, useApiQuery } from "@repo/api/react";
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

  return useApiQuery(queryFn, { enabled: isAuthenticated && enabled });
}

export function useActivateSetup(opts?: {
  onSuccess?: (data: TenantSetupStateDto) => void;
}) {
  const client = useMemo(() => createPlatformApiClient(), []);

  return useApiMutation<TenantSetupStateDto, void>(
    () => client.post<TenantSetupStateDto>(coreSetupPaths.activate()),
    opts
  );
}

export function useSetupReadiness(enabled = true) {
  const { isAuthenticated } = useAuth();
  const client = useMemo(() => createPlatformApiClient(), []);

  const queryFn = useCallback(
    (signal: AbortSignal) =>
      client.get<DraftSetupReadinessDto>(coreSetupPaths.readiness(), { signal }),
    [client]
  );

  return useApiQuery(queryFn, { enabled: isAuthenticated && enabled });
}

export function useApproveStructure(opts?: {
  onSuccess?: (data: TenantSetupStateDto) => void;
}) {
  const client = useMemo(() => createPlatformApiClient(), []);

  return useApiMutation<TenantSetupStateDto, VersionedSetupMutationArgs>(
    ({ expectedVersion }) =>
      client.post<TenantSetupStateDto>(coreSetupPaths.approve(), undefined, {
        headers: { "If-Match": `"${expectedVersion}"` },
      }),
    opts
  );
}

export function useReopenStructure(opts?: {
  onSuccess?: (data: TenantSetupStateDto) => void;
}) {
  const client = useMemo(() => createPlatformApiClient(), []);

  return useApiMutation<TenantSetupStateDto, VersionedSetupMutationArgs>(
    ({ expectedVersion }) =>
      client.post<TenantSetupStateDto>(coreSetupPaths.reopen(), undefined, {
        headers: { "If-Match": `"${expectedVersion}"` },
      }),
    opts
  );
}
