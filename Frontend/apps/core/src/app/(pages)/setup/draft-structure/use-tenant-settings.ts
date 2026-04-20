"use client";

import { useCallback, useMemo } from "react";
import {
  createPlatformApiClient,
  tenantSettingsPaths,
  type TenantSettingsDto,
  type UpdateTenantSettingsRequest,
} from "@repo/api";
import { useApiMutation, useApiQuery } from "@repo/api/react";
import { useAuth } from "@repo/auth";

interface UpdateTenantSettingsArgs {
  expectedVersion: number | null;
  input: UpdateTenantSettingsRequest;
}

export function useTenantSettings(enabled = true) {
  const { isAuthenticated } = useAuth();
  const client = useMemo(() => createPlatformApiClient(), []);

  const queryFn = useCallback(
    (signal: AbortSignal) =>
      client.get<TenantSettingsDto>(tenantSettingsPaths.current(), {
        signal,
      }),
    [client]
  );

  return useApiQuery(queryFn, { enabled: isAuthenticated && enabled });
}

export function useUpdateTenantSettings(opts?: {
  onSuccess?: (data: TenantSettingsDto) => void;
}) {
  const client = useMemo(() => createPlatformApiClient(), []);

  return useApiMutation<TenantSettingsDto, UpdateTenantSettingsArgs>(
    ({ expectedVersion, input }) =>
      client.patch<TenantSettingsDto>(tenantSettingsPaths.current(), input, {
        headers:
          expectedVersion == null
            ? undefined
            : { "If-Match": `"${expectedVersion}"` },
      }),
    opts
  );
}