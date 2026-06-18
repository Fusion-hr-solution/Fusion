"use client";

import { useCallback } from "react";
import { useApiQuery } from "@repo/api/react";
import { getAdminPlanning } from "@/services/calendar-service";
import type { AdminPlanningEventDto, AdminPlanningFilters } from "@/types/calendar";

/** Loads admin planning events for the given (stable) filters. */
export function useAdminPlanning(filters: AdminPlanningFilters) {
  const fetcher = useCallback(
    () => getAdminPlanning(filters),
    [
      filters.fromUtc,
      filters.toUtc,
      filters.serviceLineId,
      filters.gradeId,
      filters.trainerEmployeeId,
      filters.room,
      filters.status,
    ],
  );
  return useApiQuery<AdminPlanningEventDto[]>(fetcher);
}
