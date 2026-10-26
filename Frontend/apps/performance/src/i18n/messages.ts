import settings from "../../messages/en/settings.json";

/** Performance's own catalogue in English, one file per namespace (`messages/<locale>/<namespace>.json`). */
export const englishMessages = { settings };

export type PerformanceMessages = typeof englishMessages;

/** Performance's own catalogue in a language, merged by the request config beside @repo/ds's and @repo/auth's. Anything but French gets English. */
export async function loadPerformanceMessages(locale: string): Promise<PerformanceMessages> {
  if (locale !== "fr") return englishMessages;
  const namespaces = Object.keys(englishMessages);
  const files = await Promise.all(
    namespaces.map(async (namespace) => [namespace, (await import(`../../messages/fr/${namespace}.json`)).default]),
  );
  return Object.fromEntries(files) as PerformanceMessages;
}
