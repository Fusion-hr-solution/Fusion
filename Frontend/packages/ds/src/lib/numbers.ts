/**
 * Fusion's numbers, in the same locale as its dates ("1,234", "42%", "1.5"; in French "1 234", "42 %", "1,5").
 * Each takes the person's language last; absent, it is English.
 */
import { formatLocale } from "./dates";

/** A number as Fusion writes it; options shape it (fraction digits, compact notation). */
export function formatNumber(value: number, options?: Intl.NumberFormatOptions, locale?: string): string {
  return new Intl.NumberFormat(formatLocale(locale), options).format(value);
}

/** A ratio as a percentage: 0.42 gives "42%". */
export function formatPercent(ratio: number, options?: Omit<Intl.NumberFormatOptions, "style">, locale?: string): string {
  return new Intl.NumberFormat(formatLocale(locale), { maximumFractionDigits: 0, ...options, style: "percent" }).format(ratio);
}

/** A count of things: whole and grouped ("1,234"). */
export function formatCount(count: number, locale?: string): string {
  return new Intl.NumberFormat(formatLocale(locale), { maximumFractionDigits: 0 }).format(count);
}
