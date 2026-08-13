"use client";

import { useCallback, useMemo } from "react";
import {
  coreOrganizationImportQueryKeys,
  createCoreOrganizationImportApi,
  createPlatformApiClient,
} from "@repo/api";
import { useApiMutation, useApiQuery, useApiQueryClient } from "@repo/api/query";
import { canManageCoreOrganization, useAuth } from "@repo/auth";

export function useOrganizationImportApi() {
  const client = useMemo(() => createPlatformApiClient(), []);
  return useMemo(() => createCoreOrganizationImportApi(client), [client]);
}

function useImportEnabled(enabled: boolean) {
  const { user, isAuthenticated, isLoading } = useAuth();
  return !isLoading && isAuthenticated && canManageCoreOrganization(user) && enabled;
}

export function useActiveOrganizationImports(enabled = true) {
  const api = useOrganizationImportApi();
  const canRead = useImportEnabled(enabled);
  return useApiQuery(
    coreOrganizationImportQueryKeys.active(),
    useCallback((signal) => api.active(signal), [api]),
    { enabled: canRead }
  );
}

export function useOrganizationImportSession(id: string, enabled = true) {
  const api = useOrganizationImportApi();
  const canRead = useImportEnabled(enabled && Boolean(id));
  return useApiQuery(
    coreOrganizationImportQueryKeys.session(id),
    useCallback((signal) => api.session(id, signal), [api, id]),
    { enabled: canRead }
  );
}

export function useOrganizationImportMutations() {
  const api = useOrganizationImportApi();
  const queryClient = useApiQueryClient();
  const refreshAll = useCallback(
    () => queryClient.invalidateQueries({ queryKey: coreOrganizationImportQueryKeys.all() }),
    [queryClient]
  );
  return {
    intake: useApiMutation(api.intake, { onSuccess: refreshAll }),
    changeDate: useApiMutation(
      ({ id, version, effectiveDate }: { id: string; version: number; effectiveDate: string }) =>
        api.changeEffectiveDate(id, version, effectiveDate),
      { onSuccess: refreshAll }
    ),
    discard: useApiMutation(
      ({ id, version }: { id: string; version: number }) => api.discard(id, version),
      { onSuccess: refreshAll }
    ),
  };
}
