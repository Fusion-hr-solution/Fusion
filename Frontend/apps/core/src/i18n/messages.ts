import invite from "../../messages/en/invite.json";
import settings from "../../messages/en/settings.json";

/** Core HR's own catalogue in English, one file per namespace (`messages/<locale>/<namespace>.json`). */
export const englishMessages = { invite, settings };

export type CoreMessages = typeof englishMessages;

/** Core HR's own catalogue in a language, merged by the request config beside @repo/ds's and @repo/auth's. Anything but French gets English. */
export async function loadCoreMessages(locale: string): Promise<CoreMessages> {
  if (locale !== "fr") return englishMessages;
  const namespaces = Object.keys(englishMessages);
  const files = await Promise.all(
    namespaces.map(async (namespace) => [namespace, (await import(`../../messages/fr/${namespace}.json`)).default]),
  );
  return Object.fromEntries(files) as CoreMessages;
}
