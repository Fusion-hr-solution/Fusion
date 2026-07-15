"use client";

import { useCallback } from "react";
import { useApiQuery } from "@repo/api/react";
import type { FeedbackQuestion } from "@/types";
import { getTrainingFeedbackQuestions } from "@/services/feedback-service";

export function useTrainingFeedbackQuestions(trainingId: string, enabled = true) {
  const fetcher = useCallback(() => getTrainingFeedbackQuestions(trainingId), [trainingId]);
  const { data, isLoading } = useApiQuery<FeedbackQuestion[]>(fetcher, {
    enabled: enabled && !!trainingId,
  });
  return { questions: data ?? [], isLoading };
}
