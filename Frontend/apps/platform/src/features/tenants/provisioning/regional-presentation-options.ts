/**
 * Presentation defaults shown on the Region & products step.
 *
 * Frontend-only for now: the provisioning contract accepts locale and time zone,
 * not country, currency, or date format, so these three are captured in the
 * draft but not yet sent. When the backend gains these as tenant defaults, wire
 * them into the mutation — nothing else here needs to change.
 */
import { formatLocale } from "@repo/ds/lib/dates";

export interface PresentationOption {
  value: string;
  label: string;
  keywords: string;
}

export const DEFAULT_COUNTRY = "TN";
export const DEFAULT_DATE_FORMAT = "DD/MM/YYYY";

const COUNTRIES: { value: string; flag: string; keywords: string }[] = [
  { value: "TN", flag: "🇹🇳", keywords: "tunisia tunisie tn" },
  { value: "FR", flag: "🇫🇷", keywords: "france french fr" },
  { value: "DE", flag: "🇩🇪", keywords: "germany deutschland de" },
  { value: "GB", flag: "🇬🇧", keywords: "united kingdom britain gb uk" },
  { value: "US", flag: "🇺🇸", keywords: "united states america us usa" },
  { value: "CA", flag: "🇨🇦", keywords: "canada ca" },
  { value: "ES", flag: "🇪🇸", keywords: "spain españa es" },
  { value: "IT", flag: "🇮🇹", keywords: "italy italia it" },
  { value: "MA", flag: "🇲🇦", keywords: "morocco maroc ma" },
  { value: "DZ", flag: "🇩🇿", keywords: "algeria algerie dz" },
  { value: "EG", flag: "🇪🇬", keywords: "egypt eg" },
  { value: "AE", flag: "🇦🇪", keywords: "uae emirates dubai ae" },
  { value: "SA", flag: "🇸🇦", keywords: "saudi arabia sa" },
  { value: "NL", flag: "🇳🇱", keywords: "netherlands holland nl" },
  { value: "BE", flag: "🇧🇪", keywords: "belgium be" },
  { value: "CH", flag: "🇨🇭", keywords: "switzerland suisse ch" },
];

/** A country's name in the person's language ("Tunisia", "Tunisie"), from the runtime rather than a table. */
export function countryName(code: string, locale = "en"): string {
  try {
    return new Intl.DisplayNames([formatLocale(locale)], { type: "region" }).of(code) ?? code;
  } catch {
    return code;
  }
}

/** Country/region, labelled with its flag so it reads at a glance. */
export function countryOptions(locale = "en"): PresentationOption[] {
  return COUNTRIES.map(({ value, flag, keywords }) => {
    const name = countryName(value, locale);
    return { value, label: `${flag} ${name}`, keywords: `${keywords} ${name.toLowerCase()}` };
  });
}

/** The chosen country as the list shows it, flag included. */
export function countryLabel(code: string, locale = "en"): string {
  return countryOptions(locale).find((option) => option.value === code)?.label ?? code;
}

/** How dates read across the tenant. */
const DATE_FORMATS: PresentationOption[] = [
  { value: "DD/MM/YYYY", label: "DD/MM/YYYY", keywords: "day month year european 31/12/2026" },
  { value: "MM/DD/YYYY", label: "MM/DD/YYYY", keywords: "month day year us american 12/31/2026" },
  { value: "YYYY-MM-DD", label: "YYYY-MM-DD", keywords: "iso year month day 2026-12-31" },
  { value: "DD.MM.YYYY", label: "DD.MM.YYYY", keywords: "day month year dot 31.12.2026" },
];

/** A date format's pattern as a reader of that language writes it ("JJ/MM/AAAA" in French). */
export function dateFormatLabel(value: string, locale = "en"): string {
  return locale === "fr" ? value.replace(/D/g, "J").replace(/Y/g, "A") : value;
}

export function dateFormatOptions(locale = "en"): PresentationOption[] {
  return DATE_FORMATS.map((option) => ({
    ...option,
    label: dateFormatLabel(option.value, locale),
    keywords: `${option.keywords} ${option.value}`,
  }));
}
