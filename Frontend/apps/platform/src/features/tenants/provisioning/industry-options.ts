import type { Say } from "@repo/ds/lib/say";
import type { SearchableOption } from "./searchable-select";

/**
 * The industries a tenant can be classified under, chosen at provisioning.
 *
 * A curated, searchable list rather than a free-text box: the value is
 * descriptive tenant metadata that only helps if it stays consistent across
 * tenants, and typing invites near-duplicates ("Fintech" vs "Financial
 * Services") that make the field useless for grouping. The stored value is the
 * English label itself — human-readable in the record and stable enough for an
 * optional descriptor — whatever language the operator reads the list in.
 *
 * The leading blank option is how an operator clears a choice they made by
 * mistake; industry is optional, so "Not specified" is a legitimate answer.
 */
const INDUSTRIES: { value: string; id: string; keywords: string }[] = [
  { value: "", id: "notSpecified", keywords: "none unspecified blank skip" },
  {
    value: "Technology & Software",
    id: "technology",
    keywords: "tech it saas software internet digital startup",
  },
  {
    value: "Financial Services",
    id: "financial",
    keywords: "finance banking fintech insurance investment capital",
  },
  {
    value: "Healthcare & Life Sciences",
    id: "healthcare",
    keywords: "health medical pharma biotech hospital clinical",
  },
  {
    value: "Manufacturing",
    id: "manufacturing",
    keywords: "industrial factory production automotive engineering",
  },
  {
    value: "Retail & Consumer Goods",
    id: "retail",
    keywords: "retail ecommerce consumer fmcg shopping goods",
  },
  {
    value: "Professional Services",
    id: "professional",
    keywords: "consulting legal accounting advisory agency services",
  },
  {
    value: "Education",
    id: "education",
    keywords: "education school university academic training edtech",
  },
  {
    value: "Government & Public Sector",
    id: "government",
    keywords: "government public sector civic municipal agency state",
  },
  {
    value: "Energy & Utilities",
    id: "energy",
    keywords: "energy utilities oil gas power renewable electricity water",
  },
  {
    value: "Construction & Real Estate",
    id: "construction",
    keywords: "construction real estate property building infrastructure",
  },
  {
    value: "Transportation & Logistics",
    id: "transportation",
    keywords: "transport logistics shipping freight supply chain mobility",
  },
  {
    value: "Media & Entertainment",
    id: "media",
    keywords: "media entertainment publishing gaming music film content",
  },
  {
    value: "Hospitality & Travel",
    id: "hospitality",
    keywords: "hospitality travel tourism hotel restaurant leisure",
  },
  {
    value: "Telecommunications",
    id: "telecommunications",
    keywords: "telecom telecommunications mobile network carrier isp",
  },
  {
    value: "Nonprofit",
    id: "nonprofit",
    keywords: "nonprofit ngo charity foundation social impact",
  },
  {
    value: "Agriculture",
    id: "agriculture",
    keywords: "agriculture farming agtech food crops livestock",
  },
  {
    value: "Other",
    id: "other",
    keywords: "other misc miscellaneous unlisted",
  },
];

/** The industries in one language; the stored English value finds them in any. */
export function industryOptions(say: Say): SearchableOption[] {
  return INDUSTRIES.map(({ value, id, keywords }) => {
    const label = say(`industries.${id}`);
    return { value, label, keywords: `${keywords} ${value} ${label}` };
  });
}

/** A stored industry in one language; one this build does not know reads as stored. */
export function industryLabel(value: string, say: Say): string {
  const known = INDUSTRIES.find((industry) => industry.value === value);
  return known && value ? say(`industries.${known.id}`) : value;
}
