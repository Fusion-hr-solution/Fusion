// @repo/auth/i18n — @repo/auth's own catalogue (namespace `auth`), merged into each app's beside @repo/ds's.
// Server-safe: the apps' next-intl request configs import it.

import en from "./messages/en.json";

export type AuthMessages = typeof en;

/** @repo/auth's messages; unknown locales get English. */
export async function loadAuthMessages(locale: string): Promise<AuthMessages> {
  if (locale === "fr") return (await import("./messages/fr.json")).default;
  if (locale === "ar") return (await import("./messages/ar.json")).default;
  return en;
}
