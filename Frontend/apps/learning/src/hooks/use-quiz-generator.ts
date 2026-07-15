"use client";

import { useCallback } from "react";
import { useApiQuery, useApiMutation } from "@repo/api/react";
import {
  getQuizDraft,
  generateQuiz,
  saveQuizDraft,
  publishQuiz,
  discardQuizDraft,
} from "@/services/admin-service";
import type { QuizDraftQuestionInput } from "@/types/admin";

/**
 * US-8.2.5 — drives the AI quiz panel: loads the persisted draft (only while `enabled`) and exposes
 * the generate / save / publish / discard mutations. The panel owns the editable working copy.
 */
export function useQuizGenerator(trainingId: string, enabled: boolean) {
  const fetchDraft = useCallback(() => getQuizDraft(trainingId), [trainingId]);
  const {
    data: draft,
    isLoading,
    refetch,
  } = useApiQuery(fetchDraft, { enabled });

  const { mutateAsync: doGenerate, isLoading: isGenerating } = useApiMutation(
    (count: number) => generateQuiz(trainingId, count)
  );

  const { mutateAsync: doSave, isLoading: isSaving } = useApiMutation(
    (questions: QuizDraftQuestionInput[]) => saveQuizDraft(trainingId, questions)
  );

  const { mutateAsync: doPublish, isLoading: isPublishing } = useApiMutation(
    (questions: QuizDraftQuestionInput[]) => publishQuiz(trainingId, questions)
  );

  const { mutateAsync: doDiscard, isLoading: isDiscarding } = useApiMutation(
    () => discardQuizDraft(trainingId)
  );

  return {
    draft,
    isLoading,
    refetch,
    doGenerate,
    isGenerating,
    doSave,
    isSaving,
    doPublish,
    isPublishing,
    doDiscard,
    isDiscarding,
  };
}
