"use client";

import { useCallback, useMemo } from "react";
import {
  coreOrganizationImportQueryKeys,
  createCoreOrganizationImportApi,
  createPlatformApiClient,
} from "@repo/api";
import type { OrganizationImportDecisions, OrganizationImportSemanticReviewedItem } from "@repo/api";
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
    replaceDecisions: useApiMutation(
      ({ id, version, decisions }: { id: string; version: number; decisions: OrganizationImportDecisions }) =>
        api.replaceDecisions(id, version, decisions),
      { onSuccess: refreshAll }
    ),
    refresh: useApiMutation(
      ({ id }: { id: string }) => api.refresh(id),
      { onSuccess: refreshAll }
    ),
    generateSuggestions: useApiMutation(
      ({ id, inputFingerprint, retry = false }: { id: string; inputFingerprint: string; retry?: boolean }) =>
        api.generateSemanticSuggestions(id, inputFingerprint, retry),
      { onSuccess: refreshAll }
    ),
    applySuggestions: useApiMutation(
      ({ id, version, attemptId, inputFingerprint, attemptVersion, reviewedItems }: {
        id: string;
        version: number;
        attemptId: string;
        inputFingerprint: string;
        attemptVersion: number;
        reviewedItems: OrganizationImportSemanticReviewedItem[];
      }) => api.applySemanticSuggestions(
        id,
        version,
        attemptId,
        inputFingerprint,
        attemptVersion,
        reviewedItems
      ),
      { onSuccess: refreshAll }
    ),
    commit: useApiMutation(
      ({ id, version, semanticDigest }: { id: string; version: number; semanticDigest: string }) =>
        api.commit(id, version, semanticDigest),
      { onSuccess: refreshAll }
    ),
  };
}
