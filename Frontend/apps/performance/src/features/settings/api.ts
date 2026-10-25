"use client";

import {
  fusionSettingsQueryKeys,
  performanceQueryKeys,
  type CycleSettingsDto,
  type NineBoxBandsRequest,
  type RatingScaleDto,
  type UpdateRatingScaleRequest,
} from "@repo/api";
import { useApiMutation, useApiQueryClient } from "@repo/api/query";
import { useApis } from "@/features/performance/api/use-performance";

export type CycleSettingsRequest = Omit<CycleSettingsDto, "nineBoxBands"> & {
  expectedVersion: number;
  nineBoxBands?: NineBoxBandsRequest;
};

/**
 * Saves the cycle settings behind Reviews, Planning, Conversations and AI and data. A 409 stays with the page, which
 * names who saved first; the section list refreshes so every section shows its last change.
 */
export function useSaveCycleSettings() {
  const { performance } = useApis();
  const cache = useApiQueryClient();
  return useApiMutation((request: CycleSettingsRequest) => performance.updateSettings(request), {
    onSuccess: async (saved: CycleSettingsDto) => {
      cache.setQueryData(performanceQueryKeys.settings(), saved);
      await cache.invalidateQueries({ queryKey: fusionSettingsQueryKeys.all() });
    },
  });
}

/** Saves the rating scale as its next version. */
export function useSaveRatingScale() {
  const { performance } = useApis();
  const cache = useApiQueryClient();
  return useApiMutation((request: UpdateRatingScaleRequest) => performance.updateRatingScale(request), {
    onSuccess: async (saved: RatingScaleDto) => {
      cache.setQueryData(performanceQueryKeys.ratingScale(), saved);
      await cache.invalidateQueries({ queryKey: fusionSettingsQueryKeys.all() });
    },
  });
}

/** After a competency or question saves on its own: refresh the section's last change. */
export function useRefreshSettingsSections() {
  const cache = useApiQueryClient();
  return () => cache.invalidateQueries({ queryKey: fusionSettingsQueryKeys.all() });
}
