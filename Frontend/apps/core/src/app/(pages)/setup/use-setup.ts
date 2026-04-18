"use client";

import { useCallback, useMemo } from "react";
import {
  coreSetupPaths,
  createPlatformApiClient,
  type TenantSetupStateDto,
} from "@repo/api";
import { useApiMutation, useApiQuery } from "@repo/api/react";
import { useAuth } from "@repo/auth";

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
