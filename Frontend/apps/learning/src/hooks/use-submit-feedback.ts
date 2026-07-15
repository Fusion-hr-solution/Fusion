"use client";

import { useApiMutation } from "@repo/api/react";
import type { SubmitFeedbackInput } from "@/types";
import { submitFeedback } from "@/services/feedback-service";

export interface UseSubmitFeedbackOptions {
  onSuccess?: () => void;
  onError?: (error: Error) => void;
}

export function useSubmitFeedback(options?: UseSubmitFeedbackOptions) {
  const { mutate, isLoading } = useApiMutation<string, SubmitFeedbackInput>(submitFeedback, {
    onSuccess: () => options?.onSuccess?.(),
    onError: (error) => options?.onError?.(error),
  });
  return { submit: mutate, isSubmitting: isLoading };
}
