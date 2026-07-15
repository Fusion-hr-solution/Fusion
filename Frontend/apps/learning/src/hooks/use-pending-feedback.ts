"use client";

import { useCallback } from "react";
import { useApiQuery } from "@repo/api/react";
import type { PendingFeedback } from "@/types";
import { getMyPendingFeedback } from "@/services/feedback-service";

export function usePendingFeedback() {
  const fetchPending = useCallback(() => getMyPendingFeedback(), []);
  const { data, isLoading, error, refetch } = useApiQuery<PendingFeedback[]>(fetchPending);
  return { pending: data ?? [], isLoading, error, refetch };
}
