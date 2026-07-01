"use client";

import { useCallback } from "react";
import { useApiQuery } from "@repo/api/react";
import type { TrainerGroupFeedback } from "@/types";
import { getSessionTrainerFeedback } from "@/services/admin-feedback-service";

export function useSessionTrainerFeedback(sessionId: string, enabled = true) {
  const fetcher = useCallback(() => getSessionTrainerFeedback(sessionId), [sessionId]);
  const { data, isLoading } = useApiQuery<TrainerGroupFeedback | null>(fetcher, {
    enabled: enabled && !!sessionId,
  });
  return { feedback: data ?? null, isLoading };
}
