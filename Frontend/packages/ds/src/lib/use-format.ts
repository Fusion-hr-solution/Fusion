import { useMemo } from "react";
import { useLocale } from "next-intl";
import {
  formatDate,
  formatDateParts,
  formatDateRange,
  formatDateTime,
  formatTime,
  type DateFormatOptions,
} from "./dates";
import { formatCount, formatNumber, formatPercent } from "./numbers";
import { useRelative } from "./use-relative";

type DateInput = string | Date | null | undefined;
type DateOptions = Omit<DateFormatOptions, "locale"> & { fallback?: string };

/**
 * Fusion's date and number grammar already in the person's language, for translated components: the same functions as
 * `lib/dates` and `lib/numbers` without passing the locale by hand. Pure helpers take `locale` instead.
 */
export function useFormat() {
  const locale = useLocale();
  const relative = useRelative();
  return useMemo(
    () => ({
      locale,
      /** "20 Oct", "mar. 20 oct." */
      date: (value: DateInput, options: DateOptions = {}) => formatDate(value, { ...options, locale }),
      /** "11:00" */
      time: (value: DateInput, fallback?: string) => formatTime(value, fallback, locale),
      /** "Tue 20 Oct, 11:00", "mar. 20 oct. à 11:00" */
      dateTime: (value: DateInput, options: DateOptions = {}) => formatDateTime(value, { ...options, locale }),
      /** "10 Oct – 9 Nov 2026" */
      range: (start: DateInput, end: DateInput, options: { omitYear?: boolean } = {}) =>
        formatDateRange(start, end, { ...options, locale }),
      /** A shape the named formatters don't cover ("Tuesday 20 October"). */
      parts: (value: DateInput, options: Intl.DateTimeFormatOptions, fallback?: string) =>
        formatDateParts(value, options, fallback, locale),
      /** "1,234.5", "1 234,5" */
      number: (value: number, options?: Intl.NumberFormatOptions) => formatNumber(value, options, locale),
      /** 0.42 gives "42%", "42 %" */
      percent: (ratio: number, options?: Omit<Intl.NumberFormatOptions, "style">) => formatPercent(ratio, options, locale),
      /** "1,234", "1 234" */
      count: (count: number) => formatCount(count, locale),
      /** "12 min ago", "Il y a 12 min" */
      relative,
    }),
    [locale, relative],
  );
}

export type Format = ReturnType<typeof useFormat>;
