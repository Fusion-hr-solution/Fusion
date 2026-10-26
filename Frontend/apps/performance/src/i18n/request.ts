import { createI18nRequestConfig } from "@repo/i18n/request";
import { loadDsMessages } from "@repo/ds/i18n";
import { loadAuthMessages } from "@repo/auth/i18n";
import { loadPerformanceUiMessages } from "@repo/performance-ui/i18n";
import { loadPerformanceMessages } from "./messages";

// The shared @repo/i18n resolves the language from NEXT_LOCALE; Performance adds @repo/ds's, @repo/auth's and @repo/performance-ui's catalogues to its own.
export default createI18nRequestConfig({
  loadMessages: async (locale) => ({
    ...(await loadDsMessages(locale)),
    ...(await loadAuthMessages(locale)),
    ...(await loadPerformanceUiMessages(locale)),
    ...(await loadPerformanceMessages(locale)),
  }),
});
