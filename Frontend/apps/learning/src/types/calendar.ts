// Backend calendar DTOs (camelCase JSON) for Feature 6.1 — mirror the Training API shapes.

export type CalendarEventKind = "session" | "deadline";
export type SessionStatus = "Planned" | "InProgress" | "Completed" | "Cancelled";

/** A learner calendar entry: a timed session or an all-day deadline marker. */
export interface CalendarEventDto {
  id: string;
  kind: CalendarEventKind;
  title: string;
  startUtc: string;
  endUtc: string;
  allDay: boolean;
  trainingId: string;
  partId: string | null;
  room: string | null;
  trainerName: string | null;
  sessionStatus: SessionStatus | null;
  enrollmentStatus: string | null;
  isWaitlisted: boolean;
}

/** Admin planning event (one Session); mirrors TrainingSessionListItemDto. */
export interface AdminPlanningEventDto {
  id: string;
  partId: string;
  partTitle: string;
  trainingId: string;
  trainingTitle: string;
  startUtc: string;
  endUtc: string;
  room: string;
  maxCapacity: number;
  enrolledCount: number;
  trainerName: string | null;
  trainerEmployeeId: string | null;
  status: SessionStatus;
}

export interface AdminPlanningFilters {
  fromUtc?: string;
  toUtc?: string;
  serviceLineId?: string;
  gradeId?: string;
  trainerEmployeeId?: string;
  room?: string;
  status?: string;
}

/** Returned (once) by the feed-token rotate endpoint. */
export interface CalendarFeedSubscriptionDto {
  token: string;
  feedUrl: string;
  webcalUrl: string;
}
