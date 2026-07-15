"use client";

import { useCallback } from "react";
import { useApiQuery } from "@repo/api/react";
import { getMyCalendar } from "@/services/calendar-service";
import type { CalendarEventDto } from "@/types/calendar";

/** Loads the learner's calendar events for a fixed window (pass stable ISO bounds). */
export function useMyCalendar(fromUtc: string, toUtc: string) {
  const fetcher = useCallback(
    () => getMyCalendar(fromUtc, toUtc),
    [fromUtc, toUtc],
  );
  return useApiQuery<CalendarEventDto[]>(fetcher);
}
