"use client";

import { useCallback } from "react";
import { useApiQuery } from "@repo/api/react";
import type { TrainerSession } from "@/types";
import { getMyTrainerSessions } from "@/services/feedback-service";

export function useMyTrainerSessions() {
  const fetcher = useCallback(() => getMyTrainerSessions(), []);
  const { data, isLoading, refetch } = useApiQuery<TrainerSession[]>(fetcher);
  return { sessions: data ?? [], isLoading, refetch };
}
