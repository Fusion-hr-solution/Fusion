"use client";

import { useCallback } from "react";
import { useApiQuery } from "@repo/api/react";
import {
  getSessionAttendance,
  getEmployeeAttendanceHistory,
  getAttendanceByGrade,
  getAttendanceTrend,
  getAttendanceHeatmap,
  getAttendanceSummary,
} from "@/services/admin-attendance-service";
import type {
  SessionAttendance,
  EmployeeAttendanceHistory,
  AttendanceByGrade,
  AttendanceTrend,
  AttendanceHeatmap,
  AttendanceSummary,
  AttendanceFilters,
} from "@/types/admin";

export function useSessionAttendance(sessionId: string) {
  const fetcher = useCallback(() => getSessionAttendance(sessionId), [sessionId]);
  return useApiQuery<SessionAttendance>(fetcher, { enabled: !!sessionId });
}

export function useEmployeeAttendanceHistory(
  employeeId: string,
  range: { from?: string; to?: string } = {},
) {
  const fetcher = useCallback(
    () => getEmployeeAttendanceHistory(employeeId, range),
    [employeeId, range.from, range.to],
  );
  return useApiQuery<EmployeeAttendanceHistory>(fetcher, { enabled: !!employeeId });
}

export function useAttendanceByGrade(filters: AttendanceFilters) {
  const fetcher = useCallback(
    () => getAttendanceByGrade(filters),
    [filters.gradeId, filters.serviceLineId, filters.trainingId, filters.from, filters.to],
  );
  return useApiQuery<AttendanceByGrade[]>(fetcher);
}

export function useAttendanceTrend(filters: AttendanceFilters) {
  const fetcher = useCallback(
    () => getAttendanceTrend(filters),
    [filters.gradeId, filters.serviceLineId, filters.trainingId, filters.from, filters.to],
  );
  return useApiQuery<AttendanceTrend>(fetcher);
}

export function useAttendanceHeatmap(filters: AttendanceFilters) {
  const fetcher = useCallback(
    () => getAttendanceHeatmap(filters),
    [filters.gradeId, filters.serviceLineId, filters.trainingId, filters.from, filters.to],
  );
  return useApiQuery<AttendanceHeatmap>(fetcher);
}

export function useAttendanceSummary(filters: AttendanceFilters) {
  const fetcher = useCallback(
    () => getAttendanceSummary(filters),
    [filters.gradeId, filters.serviceLineId, filters.trainingId, filters.from, filters.to],
  );
  return useApiQuery<AttendanceSummary>(fetcher);
}
