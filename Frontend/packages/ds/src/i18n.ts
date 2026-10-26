// @repo/ds/i18n — what each app needs to put @repo/ds in the person's language: its catalogue and the page direction.
// Server-safe: the apps' next-intl request configs import it.

import en from "./messages/en.json";

export type DsMessages = typeof en;
export type WritingDirection = "ltr" | "rtl";

const RIGHT_TO_LEFT = new Set(["ar", "fa", "he", "ur"]);

/** The page direction for a locale: right to left for scripts such as Arabic, else left to right. */
export function directionOf(locale: string): WritingDirection {
  return RIGHT_TO_LEFT.has(locale.split("-")[0]!.toLowerCase()) ? "rtl" : "ltr";
}

/** @repo/ds's own messages (namespace `ds`), merged into each app's catalogue. Unknown locales get English. */
export async function loadDsMessages(locale: string): Promise<DsMessages> {
  return locale === "fr" ? (await import("./messages/fr.json")).default : en;
}
