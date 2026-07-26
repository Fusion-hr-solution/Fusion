"use client";

import { useCallback, useMemo } from "react";
import {
  coreWorkforceQueryKeys,
  coreWorkforcePaths,
  coreSetupQueryKeys,
  coreSetupPaths,
  createPlatformApiClient,
  draftStructureQueryKeys,
  tenantSettingsQueryKeys,
  type DraftSetupReadinessDto,
  type TenantSetupStateDto,
  type WorkforceOrgUnitSummaryDto,
} from "@repo/api";
import {
  useApiMutation,
  useApiQuery,
  useApiQueryClient,
} from "@repo/api/query";
import { useAuth } from "@repo/auth";

export interface VersionedSetupMutationArgs {
  expectedVersion: number;
}

const SETUP_PROGRESS_STEP_KEYS = [
  "setupStarted",
  "draftReady",
  "publishedLive",
] as const;

function hasPublishedStructure(data: TenantSetupStateDto): boolean {
  if (typeof data.hasPublishedStructure === "boolean") {
    return data.hasPublishedStructure;
  }

  return (
    !!data.structurallyPublishedAt ||
    !!data.operationalAt ||
    data.currentPhase === "structurallyPublished" ||
    data.currentPhase === "operational"
  );
}

function isDraftCycleActive(data: TenantSetupStateDto): boolean {
  if (typeof data.isDraftCycleActive === "boolean") {
    return data.isDraftCycleActive;
  }

  return (
    data.currentPhase === "activated" ||
    data.currentPhase === "structurallyGoverned"
  );
}

function requiresRepublish(
  data: TenantSetupStateDto,
  options: { hasPublishedStructure: boolean; isDraftCycleActive: boolean }
): boolean {
  if (typeof data.requiresRepublish === "boolean") {
    return data.requiresRepublish;
  }

  return options.hasPublishedStructure && options.isDraftCycleActive;
}

function hasDraftStructure(
  data: TenantSetupStateDto,
  options: { hasPublishedStructure: boolean }
): boolean {
  if (typeof data.hasDraftStructure === "boolean") {
    return data.hasDraftStructure;
  }

  return (
    options.hasPublishedStructure ||
    data.currentPhase === "structurallyGoverned"
  );
}

function getNextActionLabel(options: {
  canStartSetup: boolean;
  hasDraftStructure: boolean;
  hasPublishedStructure: boolean;
  isDraftCycleActive: boolean;
  requiresRepublish: boolean;
}): string {
  if (options.canStartSetup) {
    return "Start setup";
  }

  if (options.hasPublishedStructure && !options.isDraftCycleActive) {
    return "The structure is live";
  }

  if (!options.hasDraftStructure) {
    return "Import or build the draft structure";
  }

  if (options.requiresRepublish) {
    return "Update the draft and publish the latest structure to live";
  }

  return "Publish the draft structure to live";
}

function normalizeSetupState(data: TenantSetupStateDto): TenantSetupStateDto {
  const normalizedHasPublishedStructure = hasPublishedStructure(data);
  const normalizedIsDraftCycleActive = isDraftCycleActive(data);
  const normalizedRequiresRepublish = requiresRepublish(data, {
    hasPublishedStructure: normalizedHasPublishedStructure,
    isDraftCycleActive: normalizedIsDraftCycleActive,
  });
  const normalizedHasDraftStructure = hasDraftStructure(data, {
    hasPublishedStructure: normalizedHasPublishedStructure,
  });
  const completedSteps = [
    !data.canStartSetup ? "setupStarted" : null,
    normalizedHasDraftStructure || normalizedHasPublishedStructure
      ? "draftReady"
      : null,
    normalizedHasPublishedStructure && !normalizedRequiresRepublish
      ? "publishedLive"
      : null,
  ].filter((step): step is (typeof SETUP_PROGRESS_STEP_KEYS)[number] => !!step);

  return {
    ...data,
    currentStep: completedSteps.length,
    totalSteps: SETUP_PROGRESS_STEP_KEYS.length,
    nextAction: getNextActionLabel({
      canStartSetup: data.canStartSetup,
      hasDraftStructure: normalizedHasDraftStructure,
      hasPublishedStructure: normalizedHasPublishedStructure,
      isDraftCycleActive: normalizedIsDraftCycleActive,
      requiresRepublish: normalizedRequiresRepublish,
    }),
    completedSteps,
    pendingSteps: SETUP_PROGRESS_STEP_KEYS.filter(
      (step) => !completedSteps.includes(step)
    ),
    canResumeSetup: normalizedIsDraftCycleActive,
    hasDraftStructure: normalizedHasDraftStructure,
    hasPublishedStructure: normalizedHasPublishedStructure,
    isDraftCycleActive: normalizedIsDraftCycleActive,
    requiresRepublish: normalizedRequiresRepublish,
    publishedStructureVersion: data.publishedStructureVersion ?? 0,
    recentActivities: data.recentActivities ?? [],
  };
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
      client
        .get<TenantSetupStateDto>(coreSetupPaths.state(), { signal })
        .then(normalizeSetupState),
    [client]
  );

  return useApiQuery(coreSetupQueryKeys.state(), queryFn, {
    enabled: isAuthenticated && enabled,
    // Nav-lock state: long-lived on purpose. Every setup transition writes the
    // fresh state back via setQueryData/invalidate, and refreshSetupAccess
    // force-refetches, so this never serves a stale lock decision after a
    // mutation — it only stops the query re-running on every navigation.
    staleTime: 5 * 60 * 1000,
  });
}

export function useActivateSetup(opts?: {
  onSuccess?: (data: TenantSetupStateDto) => void;
}) {
  const client = useMemo(() => createPlatformApiClient(), []);
  const queryClient = useApiQueryClient();

  return useApiMutation<TenantSetupStateDto, void>(
    () =>
      client
        .post<TenantSetupStateDto>(coreSetupPaths.activate())
        .then(normalizeSetupState),
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

export function usePublishedOrgUnits(enabled = true) {
  const { isAuthenticated } = useAuth();
  const client = useMemo(() => createPlatformApiClient(), []);

  const queryFn = useCallback(
    (signal: AbortSignal) =>
      client.get<WorkforceOrgUnitSummaryDto[]>(coreWorkforcePaths.orgUnits(), {
        signal,
      }),
    [client]
  );

  return useApiQuery(coreWorkforceQueryKeys.orgUnits(false), queryFn, {
    enabled: isAuthenticated && enabled,
  });
}

export function useReopenStructure(opts?: {
  onSuccess?: (data: TenantSetupStateDto) => void;
}) {
  const client = useMemo(() => createPlatformApiClient(), []);
  const queryClient = useApiQueryClient();

  return useApiMutation<TenantSetupStateDto, VersionedSetupMutationArgs>(
    ({ expectedVersion }) =>
      client
        .post<TenantSetupStateDto>(coreSetupPaths.reopen(), undefined, {
          headers: { "If-Match": `"${expectedVersion}"` },
        })
        .then(normalizeSetupState),
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
      client
        .post<TenantSetupStateDto>(coreSetupPaths.publish(), undefined, {
          headers: { "If-Match": `"${expectedVersion}"` },
        })
        .then(normalizeSetupState),
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
