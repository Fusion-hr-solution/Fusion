"use client";

import { useCallback, useMemo } from "react";
import {
  coreOrganizationImportQueryKeys,
  createCoreOrganizationImportApi,
  createPlatformApiClient,
} from "@repo/api";
import type {
  OrganizationImportReviewResolutionsInput,
  OrganizationImportGeneratedIdentityStrategy,
  OrganizationImportShape,
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
    resolveReview: useApiMutation(
      ({ id, version, resolutions }: { id: string; version: number; resolutions: OrganizationImportReviewResolutionsInput }) =>
        api.updateReviewResolutions(id, version, resolutions),
      {
        onSuccess: (session) => {
          queryClient.setQueryData(coreOrganizationImportQueryKeys.session(session.id), session);
          void refreshAll();
        },
        onError: () => void refreshAll(),
      }
    ),
    updateMatch: useApiMutation(
      ({ id, version, shape, fieldMappings, typeMappings, identityStrategy }: {
        id: string;
        version: number;
        shape?: OrganizationImportShape | null;
        fieldMappings?: Record<string, number | null>;
        typeMappings?: Record<string, string>;
        identityStrategy?: OrganizationImportGeneratedIdentityStrategy | null;
      }) => api.updateMatch(id, version, { shape, fieldMappings, typeMappings, identityStrategy }),
      {
        // The response is the authoritative session: land it in place, then let the rest catch up.
        onSuccess: (session) => {
          queryClient.setQueryData(coreOrganizationImportQueryKeys.session(session.id), session);
          void refreshAll();
        },
        // A stale or failed edit falls back to server truth rather than a local guess.
        onError: () => void refreshAll(),
      }
    ),
    refresh: useApiMutation(
      ({ id }: { id: string }) => api.refresh(id),
      { onSuccess: refreshAll }
    ),
    runSemanticAssistance: useApiMutation(
      ({ id, inputFingerprint, grantTenantConsent = false }: {
        id: string; inputFingerprint: string; grantTenantConsent?: boolean;
      }) => api.runSemanticAssistance(id, inputFingerprint, grantTenantConsent),
      {
        onSuccess: (session) => {
          queryClient.setQueryData(coreOrganizationImportQueryKeys.session(session.id), session);
          void refreshAll();
        },
        onError: () => void refreshAll(),
      }
    ),
    commit: useApiMutation(
      ({ id, version, proposalFingerprint }: { id: string; version: number; proposalFingerprint: string }) =>
        api.commit(id, version, proposalFingerprint),
      { onSuccess: refreshAll }
    ),
  };
}
