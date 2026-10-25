/**
 * Fusion's one date grammar. Every surface formats dates through these, so the same moment reads the same way
 * everywhere ("Tue 20 Oct", never "Oct 20, 2026" on one page and "20 Oct" on the next).
 * - A date says its year only when it isn't this year ("20 Oct", "20 Oct 2025").
 * - A weekday is added where the day of the week helps act on it (deadlines, meetings).
 * - Times are 24-hour ("11:00").
 * Date-only values ("2026-10-20") are read as that calendar day wherever the viewer is; full instants in local time.
 */
const LOCALE = "en-GB";

type DateInput = string | Date | null | undefined;

function toDate(value: DateInput): Date | null {
  if (!value) return null;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  const dateOnly = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  const date = dateOnly ? new Date(Number(dateOnly[1]), Number(dateOnly[2]) - 1, Number(dateOnly[3])) : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export interface DateFormatOptions {
  /** Add the short weekday ("Tue 20 Oct"). */
  weekday?: boolean;
  /** "auto" (default) adds the year only outside this year; "always" adds it regardless. */
  year?: "auto" | "always";
  now?: Date;
}

function parts(date: Date, { weekday = false, year = "auto", now = new Date() }: DateFormatOptions): Intl.DateTimeFormatOptions {
  return {
    ...(weekday ? { weekday: "short" as const } : {}),
    day: "numeric",
    month: "short",
    ...(year === "always" || date.getFullYear() !== now.getFullYear() ? { year: "numeric" as const } : {}),
  };
}

/** "20 Oct", "Tue 20 Oct", "20 Oct 2025". Empty input gives the fallback (an en dash by default). */
export function formatDate(value: DateInput, options: DateFormatOptions & { fallback?: string } = {}): string {
  const date = toDate(value);
  if (!date) return options.fallback ?? "–";
  return new Intl.DateTimeFormat(LOCALE, parts(date, options)).format(date).replace(",", "");
}

/** "11:00". */
export function formatTime(value: DateInput, fallback = "–"): string {
  const date = toDate(value);
  return date ? new Intl.DateTimeFormat(LOCALE, { hour: "2-digit", minute: "2-digit" }).format(date) : fallback;
}

/** "Tue 20 Oct, 11:00" (weekday by default, since a time is something to turn up to). */
export function formatDateTime(value: DateInput, options: DateFormatOptions & { fallback?: string } = {}): string {
  const date = toDate(value);
  if (!date) return options.fallback ?? "–";
  return `${formatDate(date, { weekday: true, ...options })}, ${formatTime(date)}`;
}

/** "10 Oct – 9 Nov 2026", "10 Oct 2026 – 9 Oct 2027"; `omitYear` where the context already gives it ("10 Oct – 9 Nov"). */
export function formatDateRange(start: DateInput, end: DateInput, options: { omitYear?: boolean } = {}): string {
  const from = toDate(start);
  const to = toDate(end);
  if (!from || !to) return `${formatDate(start)} – ${formatDate(end)}`;
  const day = new Intl.DateTimeFormat(LOCALE, { day: "numeric", month: "short" });
  if (options.omitYear) return `${day.format(from)} – ${day.format(to)}`;
  if (from.getFullYear() === to.getFullYear()) return `${day.format(from)} – ${day.format(to)} ${to.getFullYear()}`;
  return `${formatDate(from, { year: "always" })} – ${formatDate(to, { year: "always" })}`;
}

/** Whole calendar days from today to the value (negative once past). */
export function daysFromToday(value: DateInput, now: Date = new Date()): number | null {
  const date = toDate(value);
  if (!date) return null;
  const startOf = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  return Math.round((startOf(date) - startOf(now)) / 86_400_000);
}

/**
 * Recency for scanning: "Just now", "12 min ago", "3 h ago" today, then "Yesterday", "4 days ago" within a month, then
 * the date ("30 Sept", with the year outside this year).
 */
export function formatRelative(value: DateInput, now: Date = new Date()): string {
  const date = toDate(value);
  if (!date) return "–";
  const days = -(daysFromToday(date, now) ?? 0);
  if (days <= 0) {
    const minutes = Math.floor(Math.max(0, now.getTime() - date.getTime()) / 60_000);
    if (minutes < 1) return "Just now";
    if (minutes < 60) return `${minutes} min ago`;
    return `${Math.floor(minutes / 60)} h ago`;
  }
  if (days === 1) return "Yesterday";
  if (days < 30) return `${days} days ago`;
  return formatDate(date, { now });
}
