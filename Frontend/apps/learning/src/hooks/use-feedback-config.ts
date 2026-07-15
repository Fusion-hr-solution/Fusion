"use client";

import { useCallback } from "react";
import { useApiMutation, useApiQuery } from "@repo/api/react";
import type { FeedbackQuestion } from "@/types";
import type { CreateFeedbackQuestionInput, UpdateFeedbackQuestionInput } from "@/types/admin";
import {
  createFeedbackQuestion,
  getFeedbackQuestions,
  reorderFeedbackQuestions,
  retireFeedbackQuestion,
  updateFeedbackQuestion,
} from "@/services/admin-feedback-config-service";

/** Admin custom-form builder data + mutations for one category (or the default form). */
export function useFeedbackConfig(categoryId?: string) {
  const fetcher = useCallback(() => getFeedbackQuestions(categoryId), [categoryId]);
  const { data, isLoading, refetch } = useApiQuery<FeedbackQuestion[]>(fetcher);

  const { mutateAsync: create } = useApiMutation<string, CreateFeedbackQuestionInput>(
    (input) => createFeedbackQuestion(input),
    { onSuccess: () => refetch() },
  );
  const { mutateAsync: update } = useApiMutation<void, { id: string; input: UpdateFeedbackQuestionInput }>(
    ({ id, input }) => updateFeedbackQuestion(id, input),
    { onSuccess: () => refetch() },
  );
  const { mutateAsync: retire } = useApiMutation<void, string>(
    (id) => retireFeedbackQuestion(id),
    { onSuccess: () => refetch() },
  );
  const { mutateAsync: reorder } = useApiMutation<void, string[]>(
    (ids) => reorderFeedbackQuestions(ids),
    { onSuccess: () => refetch() },
  );

  return {
    questions: data ?? [],
    isLoading,
    refetch,
    createQuestion: create,
    updateQuestion: update,
    retireQuestion: retire,
    reorderQuestions: reorder,
  };
}
