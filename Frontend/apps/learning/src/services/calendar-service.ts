import { createPlatformApiClient } from "@repo/api";
import type {
  CalendarEventDto,
  AdminPlanningEventDto,
  AdminPlanningFilters,
  CalendarFeedSubscriptionDto,
} from "@/types/calendar";

const client = createPlatformApiClient();

/** The signed-in learner's calendar events (sessions + deadline markers) in a window. */
export async function getMyCalendar(
  fromUtc?: string,
  toUtc?: string,
): Promise<CalendarEventDto[]> {
  return client.get<CalendarEventDto[]>("/training/calendar/me", {
    params: { fromUtc, toUtc },
  });
}

/** Admin planning calendar: all sessions in a window with optional filters. */
export async function getAdminPlanning(
  filters: AdminPlanningFilters = {},
): Promise<AdminPlanningEventDto[]> {
  return client.get<AdminPlanningEventDto[]>("/training/admin/calendar", {
    params: {
      fromUtc: filters.fromUtc,
      toUtc: filters.toUtc,
      serviceLineId: filters.serviceLineId,
      gradeId: filters.gradeId,
      trainerEmployeeId: filters.trainerEmployeeId,
      room: filters.room,
      status: filters.status,
    },
  });
}

/** Issue or rotate the learner's feed token; returns the new subscribe URL (shown once). */
export async function rotateFeedToken(): Promise<CalendarFeedSubscriptionDto> {
  return client.post<CalendarFeedSubscriptionDto>(
    "/training/calendar/me/feed-token/rotate",
  );
}
