import frame from "../../messages/en/frame.json";
import provisioning from "../../messages/en/provisioning.json";
import record from "../../messages/en/record.json";
import tenants from "../../messages/en/tenants.json";

/** Platform's own catalogue in English, one file per namespace (`messages/<locale>/<namespace>.json`). */
export const englishMessages = { frame, provisioning, record, tenants };

export type PlatformMessages = typeof englishMessages;

/** Platform's own catalogue in a language, merged by the request config beside @repo/ds's and @repo/auth's. Anything but French or Arabic gets English. */
export async function loadPlatformMessages(locale: string): Promise<PlatformMessages> {
  if (locale !== "fr" && locale !== "ar") return englishMessages;
  const namespaces = Object.keys(englishMessages);
  const files = await Promise.all(
    namespaces.map(async (namespace) => [namespace, (await import(`../../messages/${locale}/${namespace}.json`)).default]),
  );
  return Object.fromEntries(files) as PlatformMessages;
}
