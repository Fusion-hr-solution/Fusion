// @repo/performance-ui/i18n — the shared Performance parts' catalogue (namespace `performanceUi`), merged into the
// catalogue of each app that renders them. Server-safe: the apps' next-intl request configs import it.

import en from "./messages/en.json";

export type PerformanceUiMessages = typeof en;

/** The catalogue in a language; anything but French gets English. */
export async function loadPerformanceUiMessages(locale: string): Promise<PerformanceUiMessages> {
  if (locale === "fr") return (await import("./messages/fr.json")).default;
  if (locale === "ar") return (await import("./messages/ar.json")).default;
  return en;
}
