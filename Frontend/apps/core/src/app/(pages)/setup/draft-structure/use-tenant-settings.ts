"use client";

import { useCallback, useMemo } from "react";
import {
  createPlatformApiClient,
  draftStructureQueryKeys,
  tenantSettingsQueryKeys,
  tenantSettingsPaths,
  type TenantSettingsDto,
  type UpdateTenantSettingsRequest,
} from "@repo/api";
import {
  useApiMutation,
  useApiQuery,
  useApiQueryClient,
} from "@repo/api/query";
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

  return useApiQuery(tenantSettingsQueryKeys.current(), queryFn, {
    enabled: isAuthenticated && enabled,
  });
}

export function useUpdateTenantSettings(opts?: {
  onSuccess?: (data: TenantSettingsDto) => void;
}) {
  const client = useMemo(() => createPlatformApiClient(), []);
  const queryClient = useApiQueryClient();

  return useApiMutation<TenantSettingsDto, UpdateTenantSettingsArgs>(
    ({ expectedVersion, input }) =>
      client.patch<TenantSettingsDto>(tenantSettingsPaths.current(), input, {
        headers:
          expectedVersion == null
            ? undefined
            : { "If-Match": `"${expectedVersion}"` },
      }),
    {
      invalidateQueries: [
        { queryKey: draftStructureQueryKeys.workspace(), exact: true },
        { queryKey: draftStructureQueryKeys.importSchema(), exact: true },
      ],
      onSuccess: async (data) => {
        queryClient.setQueryData(tenantSettingsQueryKeys.current(), data);
        await opts?.onSuccess?.(data);
      },
    }
  );
}
