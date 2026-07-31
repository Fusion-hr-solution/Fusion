"use client";

import { useMemo } from "react";
import {
  createPlatformApiClient,
  performancePaths,
  performanceQueryKeys,
  type CascadeCoverageDto,
  type PlanningCompletionWorkspaceDto,
} from "@repo/api";
import { useApiQuery } from "@repo/api/query";

/**
 * A read model powering one or more funnel stages. `available` records whether the
 * viewer is authorized to read it (and therefore whether a fetch was issued at all) —
 * an unauthorized model is never requested, so its stages degrade to plain links
 * instead of showing a forbidden-request error.
 */
export interface CampaignHandoffReadModel<T> {
  available: boolean;
  isLoading: boolean;
  isError: boolean;
  data: T | null;
}

export interface CampaignHandoff {
  cascade: CampaignHandoffReadModel<CascadeCoverageDto>;
  completion: CampaignHandoffReadModel<PlanningCompletionWorkspaceDto>;
}

export interface CampaignHandoffAccess {
  /** Viewer can read cascade coverage (Strategy + Team stages). */
  canReadCascade: boolean;
  /** Viewer can read planning completion (Employee plans + Approvals + Completion). */
  canReadCompletion: boolean;
}

/**
 * Composes the launched-campaign funnel state from existing read models only —
 * cascade coverage and planning completion. It issues no mutations: both calls are
 * plain GETs, gated so a viewer never requests a model they cannot read. The cascade
 * query shares its key with the page's cascade-coverage section, so React Query
 * dedupes it; only the completion summary is an added fetch.
 */
export function useCampaignHandoff(
  slug: string,
  access: CampaignHandoffAccess,
): CampaignHandoff {
  const apiClient = useMemo(() => createPlatformApiClient(), []);

  const cascadeEnabled = access.canReadCascade && !!slug;
  const cascade = useApiQuery<CascadeCoverageDto>(
    performanceQueryKeys.cascadeCoverage(slug),
    (signal) =>
      apiClient.get<CascadeCoverageDto>(performancePaths.cascadeCoverage(slug), {
        signal,
      }),
    { enabled: cascadeEnabled },
  );

  // Only the summary drives the funnel, so a single-row page keeps the payload minimal.
  const completionParams = useMemo(() => ({ page: 1, pageSize: 1 }), []);
  const completionEnabled = access.canReadCompletion && !!slug;
  const completion = useApiQuery<PlanningCompletionWorkspaceDto>(
    performanceQueryKeys.planningCompletionWorkspace(slug, completionParams),
    (signal) =>
      apiClient.get<PlanningCompletionWorkspaceDto>(
        performancePaths.planningCompletionWorkspace(slug),
        { signal, params: completionParams },
      ),
    { enabled: completionEnabled },
  );

  return {
    cascade: {
      available: cascadeEnabled,
      isLoading: cascade.isLoading,
      isError: cascade.error !== null,
      data: cascade.data ?? null,
    },
    completion: {
      available: completionEnabled,
      isLoading: completion.isLoading,
      isError: completion.error !== null,
      data: completion.data ?? null,
    },
  };
}
