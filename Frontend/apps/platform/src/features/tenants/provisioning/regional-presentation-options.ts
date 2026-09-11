/**
 * Presentation defaults shown on the Region & products step.
 *
 * Frontend-only for now: the provisioning contract accepts locale and time zone,
 * not country, currency, or date format, so these three are captured in the
 * draft but not yet sent. When the backend gains these as tenant defaults, wire
 * them into the mutation — nothing else here needs to change.
 */

export interface PresentationOption {
  value: string;
  label: string;
  keywords: string;
}

export const DEFAULT_COUNTRY = "TN";
export const DEFAULT_DATE_FORMAT = "DD/MM/YYYY";

/** Country/region, labelled with its flag so it reads at a glance. */
export const COUNTRY_OPTIONS: PresentationOption[] = [
  { value: "TN", label: "🇹🇳 Tunisia", keywords: "tunisia tunisie tn" },
  { value: "FR", label: "🇫🇷 France", keywords: "france french fr" },
  { value: "DE", label: "🇩🇪 Germany", keywords: "germany deutschland de" },
  { value: "GB", label: "🇬🇧 United Kingdom", keywords: "united kingdom britain gb uk" },
  { value: "US", label: "🇺🇸 United States", keywords: "united states america us usa" },
  { value: "CA", label: "🇨🇦 Canada", keywords: "canada ca" },
  { value: "ES", label: "🇪🇸 Spain", keywords: "spain españa es" },
  { value: "IT", label: "🇮🇹 Italy", keywords: "italy italia it" },
  { value: "MA", label: "🇲🇦 Morocco", keywords: "morocco maroc ma" },
  { value: "DZ", label: "🇩🇿 Algeria", keywords: "algeria algerie dz" },
  { value: "EG", label: "🇪🇬 Egypt", keywords: "egypt eg" },
  { value: "AE", label: "🇦🇪 United Arab Emirates", keywords: "uae emirates dubai ae" },
  { value: "SA", label: "🇸🇦 Saudi Arabia", keywords: "saudi arabia sa" },
  { value: "NL", label: "🇳🇱 Netherlands", keywords: "netherlands holland nl" },
  { value: "BE", label: "🇧🇪 Belgium", keywords: "belgium be" },
  { value: "CH", label: "🇨🇭 Switzerland", keywords: "switzerland suisse ch" },
];

/** How dates read across the tenant. */
export const DATE_FORMAT_OPTIONS: PresentationOption[] = [
  { value: "DD/MM/YYYY", label: "DD/MM/YYYY", keywords: "day month year european 31/12/2026" },
  { value: "MM/DD/YYYY", label: "MM/DD/YYYY", keywords: "month day year us american 12/31/2026" },
  { value: "YYYY-MM-DD", label: "YYYY-MM-DD", keywords: "iso year month day 2026-12-31" },
  { value: "DD.MM.YYYY", label: "DD.MM.YYYY", keywords: "day month year dot 31.12.2026" },
];
