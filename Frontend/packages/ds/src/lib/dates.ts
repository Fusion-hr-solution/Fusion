/**
 * Fusion's one date grammar. Every surface formats dates through these, so the same moment reads the same way
 * everywhere ("Tue 20 Oct", never "Oct 20, 2026" on one page and "20 Oct" on the next).
 * - A date says its year only when it isn't this year ("20 Oct", "20 Oct 2025").
 * - A weekday is added where the day of the week helps act on it (deadlines, meetings).
 * - Times are 24-hour ("11:00").
 * Date-only values ("2026-10-20") are read as that calendar day wherever the viewer is; full instants in local time.
 */
/** Fusion's English formatting locale, the default for every date and number. */
export const FORMAT_LOCALE = "en-GB";

/** The formatting locale for each language Fusion speaks. Anything else formats in English. */
const FORMAT_LOCALES: Record<string, string> = { en: FORMAT_LOCALE, fr: "fr-FR" };

/**
 * The formatting locale for a person's language ("en", "fr", as `useLocale()` gives it). Translated screens pass
 * their language to the formatters; untranslated ones pass nothing and stay English.
 */
export function formatLocale(language?: string): string {
  return (language && FORMAT_LOCALES[language]) || FORMAT_LOCALE;
}

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
  /** The person's language; English when absent. */
  locale?: string;
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
  return new Intl.DateTimeFormat(formatLocale(options.locale), parts(date, options)).format(date).replace(",", "");
}

/** "11:00". */
export function formatTime(value: DateInput, fallback = "–", locale?: string): string {
  const date = toDate(value);
  return date ? new Intl.DateTimeFormat(formatLocale(locale), { hour: "2-digit", minute: "2-digit" }).format(date) : fallback;
}

/** "Tue 20 Oct, 11:00", "mar. 20 oct. à 11:00" (weekday by default, since a time is something to turn up to). */
export function formatDateTime(value: DateInput, options: DateFormatOptions & { fallback?: string } = {}): string {
  const date = toDate(value);
  if (!date) return options.fallback ?? "–";
  const joiner = formatLocale(options.locale) === "fr-FR" ? " à " : ", ";
  return `${formatDate(date, { weekday: true, ...options })}${joiner}${formatTime(date, "–", options.locale)}`;
}

/** "10 Oct – 9 Nov 2026", "10 Oct 2026 – 9 Oct 2027"; `omitYear` where the context already gives it ("10 Oct – 9 Nov"). */
export function formatDateRange(
  start: DateInput,
  end: DateInput,
  options: { omitYear?: boolean; locale?: string } = {},
): string {
  const { locale } = options;
  const from = toDate(start);
  const to = toDate(end);
  if (!from || !to) return `${formatDate(start, { locale })} – ${formatDate(end, { locale })}`;
  const day = new Intl.DateTimeFormat(formatLocale(locale), { day: "numeric", month: "short" });
  if (options.omitYear) return `${day.format(from)} – ${day.format(to)}`;
  if (from.getFullYear() === to.getFullYear()) return `${day.format(from)} – ${day.format(to)} ${to.getFullYear()}`;
  return `${formatDate(from, { year: "always", locale })} – ${formatDate(to, { year: "always", locale })}`;
}

/**
 * A shape the grammar above has no name for ("Tuesday 20 October", "October", "Tue"), still in Fusion's one locale.
 * Prefer the named formatters; reach for this only when none of them fits.
 */
export function formatDateParts(
  value: DateInput,
  options: Intl.DateTimeFormatOptions,
  fallback = "–",
  locale?: string,
): string {
  const date = toDate(value);
  return date ? new Intl.DateTimeFormat(formatLocale(locale), options).format(date) : fallback;
}

/** A formatter for a shape used many times (a list, a chart axis), in the person's language (English by default). */
export function dateFormatter(options: Intl.DateTimeFormatOptions, locale?: string): Intl.DateTimeFormat {
  return new Intl.DateTimeFormat(formatLocale(locale), options);
}

/** Whole calendar days from today to the value (negative once past). */
export function daysFromToday(value: DateInput, now: Date = new Date()): number | null {
  const date = toDate(value);
  if (!date) return null;
  const startOf = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  return Math.round((startOf(date) - startOf(now)) / 86_400_000);
}

/** How recent a moment is, before it is put into words: {@link formatRelative} in English, `useRelative` in the person's language. */
export type Recency =
  | { unit: "now" }
  | { unit: "minutes" | "hours" | "days"; count: number }
  | { unit: "yesterday" }
  | { unit: "date"; date: Date };

/** The recency of a moment: minutes and hours today, days within a month, then the date. Null for empty input. */
export function recencyOf(value: DateInput, now: Date = new Date()): Recency | null {
  const date = toDate(value);
  if (!date) return null;
  const days = -(daysFromToday(date, now) ?? 0);
  if (days <= 0) {
    const minutes = Math.floor(Math.max(0, now.getTime() - date.getTime()) / 60_000);
    if (minutes < 1) return { unit: "now" };
    if (minutes < 60) return { unit: "minutes", count: minutes };
    return { unit: "hours", count: Math.floor(minutes / 60) };
  }
  if (days === 1) return { unit: "yesterday" };
  if (days < 30) return { unit: "days", count: days };
  return { unit: "date", date };
}

/**
 * Recency for scanning, in English: "Just now", "12 min ago", "3 h ago" today, then "Yesterday", "4 days ago" within a
 * month, then the date ("30 Sept", with the year outside this year). Translated screens use `useRelative`.
 */
export function formatRelative(value: DateInput, now: Date = new Date()): string {
  const recency = recencyOf(value, now);
  if (!recency) return "–";
  switch (recency.unit) {
    case "now":
      return "Just now";
    case "minutes":
      return `${recency.count} min ago`;
    case "hours":
      return `${recency.count} h ago`;
    case "yesterday":
      return "Yesterday";
    case "days":
      return `${recency.count} days ago`;
    case "date":
      return formatDate(recency.date, { now });
  }
}
