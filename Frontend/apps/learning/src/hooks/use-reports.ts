"use client";

import { useCallback } from "react";
import { useApiQuery } from "@repo/api/react";
import {
  getAttendanceByEmployee,
  getTrainingHoursByEmployee,
  getCompletionByFormat,
} from "@/services/admin-reports-service";
import type {
  AttendanceByEmployeeRow,
  TrainingHoursRow,
  FormatComparison,
  AttendanceFilters,
} from "@/types/admin";

export function useAttendanceByEmployee(filters: AttendanceFilters) {
  const fetcher = useCallback(
    () => getAttendanceByEmployee(filters),
    [filters.gradeId, filters.serviceLineId, filters.trainingId, filters.from, filters.to],
  );
  return useApiQuery<AttendanceByEmployeeRow[]>(fetcher);
}

export function useTrainingHoursByEmployee(filters: AttendanceFilters) {
  const fetcher = useCallback(
    () => getTrainingHoursByEmployee(filters),
    [filters.gradeId, filters.serviceLineId, filters.trainingId, filters.from, filters.to],
  );
  return useApiQuery<TrainingHoursRow[]>(fetcher);
}

export function useCompletionByFormat(filters: AttendanceFilters) {
  const fetcher = useCallback(
    () => getCompletionByFormat(filters),
    [filters.gradeId, filters.serviceLineId, filters.trainingId, filters.from, filters.to],
  );
  return useApiQuery<FormatComparison>(fetcher);
}
