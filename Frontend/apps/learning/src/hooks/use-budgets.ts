"use client";

import { useCallback } from "react";
import { useApiQuery, useApiMutation } from "@repo/api/react";
import { getTrainingBudgets, deleteTrainingBudget } from "@/services/admin-service";
import type { AdminTrainingBudget } from "@/types/admin";

/** Fetches training budgets (with derived spend) and exposes delete + refetch. */
export function useBudgets() {
  const fetchBudgets = useCallback(() => getTrainingBudgets(), []);
  const { data, isLoading, refetch } = useApiQuery<AdminTrainingBudget[]>(fetchBudgets, { enabled: true });

  const { mutateAsync: removeBudget } = useApiMutation(
    (id: string) => deleteTrainingBudget(id),
    { onSuccess: () => refetch() },
  );

  return { budgets: data ?? [], isLoading, refetch, deleteBudget: removeBudget };
}
