/**
 * Shared locale configuration for all microfrontends.
 *
 * This module is client-safe (no server-only imports) and is the single
 * source of truth for the supported locales, the default, and the cookie
 * name used to persist the active locale. Modules adopt it by depending on
 * `@repo/i18n` and supplying their own message catalogs.
 */

export const LOCALES = ["en", "fr"] as const;
export type Locale = (typeof LOCALES)[number];

export const DEFAULT_LOCALE: Locale = "en";

/** Cookie that carries the active locale (no `/en` `/fr` URL prefixes). */
export const LOCALE_COOKIE = "NEXT_LOCALE";

/** IANA time zone used for locale-aware date/number formatting. */
export const DEFAULT_TIME_ZONE = "Africa/Tunis";

/** Narrow an arbitrary string to a supported {@link Locale}. */
export function isLocale(value: string | undefined | null): value is Locale {
  return LOCALES.includes(value as Locale);
}
