import { cookies } from "next/headers";
import { getRequestConfig } from "next-intl/server";
import {
  DEFAULT_LOCALE,
  DEFAULT_TIME_ZONE,
  LOCALE_COOKIE,
  isLocale,
  type Locale,
} from "./config";

export interface I18nRequestOptions {
  /**
   * Load the message catalog for the resolved locale. Each module owns its own
   * catalogs, e.g. `async (locale) => (await import(`../../messages/${locale}.json`)).default`.
   */
  loadMessages: (locale: Locale) => Promise<Record<string, unknown>>;
  /** IANA time zone; defaults to {@link DEFAULT_TIME_ZONE} (Africa/Tunis). */
  timeZone?: string;
}

/** Resolve the active locale from the `NEXT_LOCALE` cookie (server-side). */
export async function resolveLocale(): Promise<Locale> {
  const cookieValue = (await cookies()).get(LOCALE_COOKIE)?.value;
  return isLocale(cookieValue) ? cookieValue : DEFAULT_LOCALE;
}

/**
 * Build the next-intl request config for a module. Locale resolution and time
 * zone are shared; the module supplies its own `loadMessages`.
 *
 * Wire it from the file referenced by `createNextIntlPlugin`:
 *
 * ```ts
 * // src/i18n/request.ts
 * import { createI18nRequestConfig } from "@repo/i18n/request";
 *
 * export default createI18nRequestConfig({
 *   loadMessages: async (locale) =>
 *     (await import(`../../messages/${locale}.json`)).default,
 * });
 * ```
 */
export function createI18nRequestConfig(options: I18nRequestOptions) {
  return getRequestConfig(async () => {
    const locale = await resolveLocale();
    return {
      locale,
      timeZone: options.timeZone ?? DEFAULT_TIME_ZONE,
      messages: await options.loadMessages(locale),
    };
  });
}
