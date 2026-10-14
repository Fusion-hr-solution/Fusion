"use client";

import {
  performanceQueryKeys,
  type AdjustCalibrationSubjectRequest,
} from "@repo/api";
import { useApiMutation, useApiQuery, useApiQueryClient } from "@repo/api/query";
import { useApis } from "./use-performance";
import { recoverPerformanceFailure } from "./performance-failure";

/** Calibration-enabled rounds of a Cycle, as a calibrator sees them from Reviews. */
export function useCalibrationRounds(cycleId: string | null, enabled = true) {
  const { performance } = useApis();
  return useApiQuery(
    performanceQueryKeys.calibrationRounds(cycleId ?? "none"),
    (signal) => performance.getCalibrationRounds(cycleId as string, signal),
    { enabled: Boolean(cycleId) && enabled }
  );
}

/** The round's session. 404 means it has not been opened; 403 means the caller is not named on it. */
export function useCalibrationSession(roundId: string, enabled = true) {
  const { performance } = useApis();
  return useApiQuery(
    performanceQueryKeys.calibration(roundId),
    (signal) => performance.getCalibration(roundId, signal),
    { enabled, retry: false }
  );
}

export function useFacilitatorCandidates(roundId: string, enabled = true) {
  const { performance } = useApis();
  return useApiQuery(
    performanceQueryKeys.calibrationCandidates(roundId),
    (signal) => performance.getCalibrationCandidates(roundId, signal),
    { enabled }
  );
}

export function useCalibrationMutations(roundId: string, cycleId: string | null) {
  const { performance } = useApis();
  const cache = useApiQueryClient();
  const invalidateQueries = [
    { queryKey: performanceQueryKeys.calibration(roundId) },
    ...(cycleId ? [
      { queryKey: performanceQueryKeys.calibrationRounds(cycleId) },
      { queryKey: performanceQueryKeys.reviewWork(cycleId) },
      { queryKey: performanceQueryKeys.workspaceContext(cycleId) },
    ] : []),
  ];
  const options = {
    invalidateQueries,
    onError: async (error: unknown) => {
      await recoverPerformanceFailure(error, () => cache.invalidateQueries({ queryKey: performanceQueryKeys.calibration(roundId) }));
    },
  };
  const open = useApiMutation(() => performance.openCalibration(roundId), options);
  const setFacilitators = useApiMutation(
    (args: { userIds: string[]; expectedVersion: number }) => performance.setCalibrationFacilitators(roundId, args.userIds, args.expectedVersion),
    options
  );
  const adjust = useApiMutation(
    (input: { reviewId: string } & AdjustCalibrationSubjectRequest) => {
      const { reviewId, ...request } = input;
      return performance.adjustCalibrationSubject(roundId, reviewId, request);
    },
    // A subject edit changes only the session's counts, distribution and that subject.
    { ...options, invalidateQueries: [{ queryKey: performanceQueryKeys.calibration(roundId) }] }
  );
  const finalize = useApiMutation(
    (expectedVersion: number) => performance.finalizeCalibration(roundId, expectedVersion),
    { ...options, invalidateQueries: [...invalidateQueries, { queryKey: performanceQueryKeys.reviewRoundStatus(roundId) }] }
  );
  return { open, setFacilitators, adjust, finalize };
}
