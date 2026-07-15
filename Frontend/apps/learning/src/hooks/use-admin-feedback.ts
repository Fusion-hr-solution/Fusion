"use client";

import { useCallback } from "react";
import { useApiQuery } from "@repo/api/react";
import type {
  FeedbackOverview,
  FeedbackOverviewFilters,
  TrainerFeedbackDetail,
  TrainerFeedbackListItem,
  TrainingFeedbackSummary,
} from "@/types/admin";
import {
  getFeedbackOverview,
  getTrainerFeedbackDetail,
  getTrainerFeedbackList,
  getTrainingFeedback,
} from "@/services/admin-feedback-service";

export function useTrainingFeedback(trainingId: string) {
  const fetcher = useCallback(() => getTrainingFeedback(trainingId), [trainingId]);
  return useApiQuery<TrainingFeedbackSummary>(fetcher, { enabled: !!trainingId });
}

export function useTrainerFeedbackList() {
  const fetcher = useCallback(() => getTrainerFeedbackList(), []);
  return useApiQuery<TrainerFeedbackListItem[]>(fetcher);
}

export function useTrainerFeedbackDetail(trainerKey: string) {
  const fetcher = useCallback(() => getTrainerFeedbackDetail(trainerKey), [trainerKey]);
  return useApiQuery<TrainerFeedbackDetail>(fetcher, { enabled: !!trainerKey });
}

export function useFeedbackOverview(filters: FeedbackOverviewFilters) {
  const fetcher = useCallback(
    () => getFeedbackOverview(filters),
    [filters.categoryId, filters.format, filters.from, filters.to],
  );
  return useApiQuery<FeedbackOverview>(fetcher);
}
