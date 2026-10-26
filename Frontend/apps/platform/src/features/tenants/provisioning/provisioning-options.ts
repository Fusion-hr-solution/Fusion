import { dateFormatter, formatLocale } from "@repo/ds/lib/dates";

/**
 * Bounded regional choices for provisioning.
 *
 * Both become canonical tenant settings, so the workspace offers real values
 * rather than free text an operator could only get wrong.
 */

export const DEFAULT_LOCALE = "en-US";
export const DEFAULT_TIME_ZONE = "UTC";

/**
 * The tenant takes the platform's own locale. Sent as an empty value, which the
 * service normalizes — so the choice stays the service's to define rather than
 * this form hard-coding today's answer as though the operator had picked it.
 */
export const PLATFORM_DEFAULT_LOCALE = "";

export interface LocaleOption {
  value: string;
  label: string;
  /** Everything worth matching a search against: language, country, and code. */
  keywords: string;
}

/** The locales Fusion presents its product language in. */
const LOCALES: Omit<LocaleOption, "label">[] = [
  { value: "en-US", keywords: "english united states us american en-US" },
  { value: "en-GB", keywords: "english united kingdom gb britain british en-GB" },
  { value: "fr-FR", keywords: "french france français fr-FR" },
  { value: "ar-TN", keywords: "arabic tunisia tunisie العربية ar-TN" },
];

/**
 * A locale's name in the person's language ("English (United States)",
 * "Anglais (États-Unis)"), from the runtime rather than a table.
 */
export function localeName(value: string, language = "en"): string {
  try {
    const name = new Intl.DisplayNames([formatLocale(language)], {
      type: "language",
      languageDisplay: "standard",
    }).of(value);
    return name ? name.charAt(0).toLocaleUpperCase(formatLocale(language)) + name.slice(1) : value;
  } catch {
    return value;
  }
}

/** The choices, the platform's own default first; `platformDefault` is its label in the person's language. */
export function localeOptions(platformDefault: string, language = "en"): LocaleOption[] {
  return [
    {
      value: PLATFORM_DEFAULT_LOCALE,
      label: platformDefault,
      keywords: `platform default inherit standard ${platformDefault}`,
    },
    ...LOCALES.map((locale) => {
      const label = localeName(locale.value, language);
      return { ...locale, label, keywords: `${locale.keywords} ${label}` };
    }),
  ];
}

/**
 * The zone's current offset from UTC, which is how an operator who does not
 * recognise an IANA name still recognises the zone. Read from the runtime rather
 * than tabulated, so it stays right across daylight-saving changes.
 */
export function timeZoneOffset(zone: string): string {
  try {
    // `longOffset` gives a padded, uniform form — "GMT+01:00" rather than
    // "GMT+1" — so offsets align down the list and a search for "UTC+09"
    // matches as readily as "UTC+9".
    const formatted = dateFormatter({
      timeZone: zone,
      timeZoneName: "longOffset",
    })
      .formatToParts(new Date())
      .find((part) => part.type === "timeZoneName")?.value;

    // Chrome reports plain "GMT" at zero offset; "UTC+00:00" reads consistently
    // beside every other entry.
    return formatted === "GMT" ? "UTC+00:00" : (formatted ?? "").replace("GMT", "UTC");
  } catch {
    return "";
  }
}

/**
 * IANA zones the runtime itself knows about, grouped by region so the list can
 * be scanned. Falls back to a small set on runtimes without `supportedValuesOf`.
 */
export function timeZoneGroups(): Array<{ region: string; zones: string[] }> {
  const zones = readSupportedTimeZones();
  const groups = new Map<string, string[]>();

  for (const zone of zones) {
    const region = zone.includes("/") ? zone.split("/")[0]! : "Other";
    const existing = groups.get(region);
    if (existing) {
      existing.push(zone);
    } else {
      groups.set(region, [zone]);
    }
  }

  return [...groups.entries()]
    .map(([region, list]) => ({ region, zones: list.sort() }))
    .sort((a, b) => a.region.localeCompare(b.region));
}

function readSupportedTimeZones(): string[] {
  const intl = Intl as typeof Intl & {
    supportedValuesOf?: (key: string) => string[];
  };

  const supported = intl.supportedValuesOf?.("timeZone");
  if (supported && supported.length > 0) {
    return [DEFAULT_TIME_ZONE, ...supported];
  }

  return [DEFAULT_TIME_ZONE, "Africa/Tunis", "Europe/Paris", "Europe/London"];
}

/** The operator's own zone is the likeliest answer, so it is the default. */
export function resolveInitialTimeZone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || DEFAULT_TIME_ZONE;
  } catch {
    return DEFAULT_TIME_ZONE;
  }
}

export function labelForTimeZone(zone: string): string {
  return zone.replace(/_/g, " ");
}

export function labelForLocale(value: string, language = "en"): string {
  return LOCALES.some((option) => option.value === value) ? localeName(value, language) : value;
}

export interface TimeZoneOption {
  value: string;
  label: string;
  offset: string;
  region: string;
  /** Zone, city and offset together, so any of the three finds it. */
  keywords: string;
}

/**
 * Every zone the runtime knows, flattened for searching. Built once per session:
 * the list runs to several hundred entries and its offsets do not change while
 * the form is open.
 */
export function timeZoneOptions(): TimeZoneOption[] {
  return timeZoneGroups().flatMap((group) =>
    group.zones.map((zone) => {
      const offset = timeZoneOffset(zone);
      const label = labelForTimeZone(zone);

      return {
        value: zone,
        label,
        offset,
        region: group.region,
        // The city is what an operator usually knows, and it is the part after
        // the slash — worth matching on its own as well as within the path.
        // The unpadded offset is included too, so "UTC+9" finds "UTC+09:00".
        keywords: [
          label,
          zone,
          offset,
          offset.replace(/([+-])0(\d)/, "$1$2"),
          label.split("/").pop() ?? "",
        ].join(" "),
      };
    })
  );
}
