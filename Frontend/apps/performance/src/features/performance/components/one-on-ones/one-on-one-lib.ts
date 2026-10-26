import type { OneOnOneCadence } from "@repo/api";
import { formatDate, formatDateParts } from "@repo/ds/lib/dates";

export const CADENCE_LABEL: Record<OneOnOneCadence, string> = {
  Weekly: "Weekly",
  EveryTwoWeeks: "Every two weeks",
  Monthly: "Monthly",
};

export const CADENCES: readonly OneOnOneCadence[] = ["Weekly", "EveryTwoWeeks", "Monthly"];

function sameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

/** "Today 14:00", "Tomorrow 10:00", then "Tue 21 Oct · 10:00": a meeting time reads by how near it is. */
export function meetingTime(iso: string, now: Date = new Date()): string {
  const at = new Date(iso);
  const time = formatDateParts(at, { hour: "2-digit", minute: "2-digit" });
  const tomorrow = new Date(now);
  tomorrow.setDate(now.getDate() + 1);
  if (sameDay(at, now)) return `Today ${time}`;
  if (sameDay(at, tomorrow)) return `Tomorrow ${time}`;
  const day = formatDateParts(at, {
    weekday: "short",
    day: "numeric",
    month: "short",
    ...(at.getFullYear() === now.getFullYear() ? {} : { year: "numeric" }),
  });
  return `${day} · ${time}`;
}

/** The long form for a heading: "Tuesday 21 October, 10:00". */
export function meetingHeading(iso: string): string {
  const at = new Date(iso);
  return `${formatDateParts(at, { weekday: "long", day: "numeric", month: "long" })}, ${formatDateParts(at, { hour: "2-digit", minute: "2-digit" })}`;
}

export function isSoon(iso: string | null, now: Date = new Date()): boolean {
  if (!iso) return false;
  const at = new Date(iso);
  return sameDay(at, now) || at.getTime() < now.getTime();
}

/** `YYYY-MM-DD` in local time. */
export function localDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function localTime(date: Date): string {
  return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}

/** A local date and time as the instant the API stores. */
export function toInstant(date: string, time: string): string {
  return new Date(`${date}T${time}:00`).toISOString();
}

/** Half-hour slots across a working day, for the time select. */
export const TIME_SLOTS: readonly string[] = Array.from({ length: 27 }, (_, i) => {
  const minutes = 7 * 60 + i * 30;
  return `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${minutes % 60 === 0 ? "00" : "30"}`;
});

/** The next weekday at 10:00, the default first meeting. */
export function defaultFirstMeeting(now: Date = new Date()): { date: string; time: string } {
  const next = new Date(now);
  next.setDate(now.getDate() + 1);
  while (next.getDay() === 0 || next.getDay() === 6) next.setDate(next.getDate() + 1);
  return { date: localDate(next), time: "10:00" };
}

/** The local day of an instant ("17 Oct", "17 Oct 2025"). */
export function formatDay(iso: string | null | undefined): string {
  return formatDate(iso, { fallback: "" });
}

/** The next `count` meetings after `fromIso` on a series' rhythm, as the server schedules them. */
export function nextOccurrences(fromIso: string, cadence: OneOnOneCadence, count: number): Date[] {
  const dates: Date[] = [];
  const at = new Date(fromIso);
  for (let i = 0; i < count; i++) {
    if (cadence === "Monthly") at.setMonth(at.getMonth() + 1);
    else at.setDate(at.getDate() + (cadence === "Weekly" ? 7 : 14));
    dates.push(new Date(at));
  }
  return dates;
}

/** A meeting time as a block: "Today" over "14:00", a weekday this week, else the date. */
export function timeBlock(iso: string, now: Date = new Date()): { day: string; time: string; today: boolean } {
  const at = new Date(iso);
  const time = formatDateParts(at, { hour: "2-digit", minute: "2-digit" });
  const tomorrow = new Date(now);
  tomorrow.setDate(now.getDate() + 1);
  const days = (at.getTime() - now.getTime()) / 86_400_000;
  const day = sameDay(at, now)
    ? "Today"
    : sameDay(at, tomorrow)
      ? "Tomorrow"
      : days > 0 && days < 6
        ? formatDateParts(at, { weekday: "short" })
        : formatDateParts(at, { day: "numeric", month: "short" });
  return { day, time, today: sameDay(at, now) || at.getTime() < now.getTime() };
}

/** "in 2 hours", "tomorrow", "in 5 days": how far off the next meeting is. */
export function howSoon(iso: string, now: Date = new Date()): string {
  const at = new Date(iso);
  const minutes = Math.round((at.getTime() - now.getTime()) / 60_000);
  if (minutes < 0) return "overdue";
  if (minutes < 60) return `in ${Math.max(minutes, 1)} min`;
  if (sameDay(at, now)) {
    const hours = Math.round(minutes / 60);
    return `in ${hours} hour${hours === 1 ? "" : "s"}`;
  }
  const tomorrow = new Date(now);
  tomorrow.setDate(now.getDate() + 1);
  if (sameDay(at, tomorrow)) return "tomorrow";
  const days = Math.round((new Date(at).setHours(0, 0, 0, 0) - new Date(now).setHours(0, 0, 0, 0)) / 86_400_000);
  return `in ${days} days`;
}

/** "17 Oct", the short day used inside rows; the year shows outside this year, so a past date never reads as coming. */
export function shortDay(iso: string | Date): string {
  return formatDate(iso);
}

/** The rhythm window the workspace draws: six weeks back (what the server sends), three weeks ahead. */
export const RHYTHM_BACK_DAYS = 42;
export const RHYTHM_AHEAD_DAYS = 21;

export function rhythmWindow(now: Date = new Date()): { start: number; end: number } {
  const day = 86_400_000;
  return { start: now.getTime() - RHYTHM_BACK_DAYS * day, end: now.getTime() + RHYTHM_AHEAD_DAYS * day };
}

/** Where an instant sits along the rhythm window, from 0 to 1. */
export function rhythmPosition(iso: string | number, window: { start: number; end: number }): number {
  const t = typeof iso === "number" ? iso : new Date(iso).getTime();
  return Math.min(1, Math.max(0, (t - window.start) / (window.end - window.start)));
}
