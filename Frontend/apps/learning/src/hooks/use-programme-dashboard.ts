"use client";

import { useApiQuery } from "@repo/api/react";
import {
  getProgrammeMatrix,
  getCompletionByGrade,
  getCompletionByServiceLine,
  getCompletionTrend,
  getCellEmployees,
} from "@/services/admin-service";
import type {
  ProgrammeMatrix,
  CompletionByGrade,
  CompletionByServiceLine,
  CompletionTrend,
  CellEmployee,
} from "@/types/admin";

export function useProgrammeMatrix() {
  return useApiQuery<ProgrammeMatrix>(getProgrammeMatrix);
}

export function useCompletionByGrade() {
  return useApiQuery<CompletionByGrade[]>(getCompletionByGrade);
}

export function useCompletionByServiceLine() {
  return useApiQuery<CompletionByServiceLine[]>(getCompletionByServiceLine);
}

export function useCompletionTrend() {
  return useApiQuery<CompletionTrend>(getCompletionTrend);
}

export function useCellEmployees(
  gradeId: string | null,
  serviceLineId: string | null,
) {
  return useApiQuery<CellEmployee[]>(
    () => getCellEmployees(gradeId!, serviceLineId!),
    { enabled: !!gradeId && !!serviceLineId },
  );
}
