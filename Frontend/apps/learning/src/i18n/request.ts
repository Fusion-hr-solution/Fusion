import { createI18nRequestConfig } from "@repo/i18n/request";

// Locale resolution, default + time zone come from the shared @repo/i18n
// package; the learning module only supplies its own message catalogs.
export default createI18nRequestConfig({
  loadMessages: async (locale) =>
    (await import(`../../messages/${locale}.json`)).default,
});
