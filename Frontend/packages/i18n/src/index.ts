// Client-safe surface: locale config only. Server-only helpers live behind the
// `@repo/i18n/request` (next-intl request config) and `@repo/i18n/locale`
// (the setLocale server action) subpath exports so they are never pulled into
// a client bundle.
export {
  LOCALES,
  DEFAULT_LOCALE,
  LOCALE_COOKIE,
  DEFAULT_TIME_ZONE,
  isLocale,
  type Locale,
} from "./config";
