import type { SearchableOption } from "./searchable-select";

/**
 * The industries a tenant can be classified under, chosen at provisioning.
 *
 * A curated, searchable list rather than a free-text box: the value is
 * descriptive tenant metadata that only helps if it stays consistent across
 * tenants, and typing invites near-duplicates ("Fintech" vs "Financial
 * Services") that make the field useless for grouping. The stored value is the
 * label itself — human-readable in the record and stable enough for an optional
 * descriptor.
 *
 * The leading blank option is how an operator clears a choice they made by
 * mistake; industry is optional, so "Not specified" is a legitimate answer.
 */
export const INDUSTRY_OPTIONS: SearchableOption[] = [
  { value: "", label: "Not specified", keywords: "none unspecified blank skip" },
  {
    value: "Technology & Software",
    label: "Technology & Software",
    keywords: "tech it saas software internet digital startup",
  },
  {
    value: "Financial Services",
    label: "Financial Services",
    keywords: "finance banking fintech insurance investment capital",
  },
  {
    value: "Healthcare & Life Sciences",
    label: "Healthcare & Life Sciences",
    keywords: "health medical pharma biotech hospital clinical",
  },
  {
    value: "Manufacturing",
    label: "Manufacturing",
    keywords: "industrial factory production automotive engineering",
  },
  {
    value: "Retail & Consumer Goods",
    label: "Retail & Consumer Goods",
    keywords: "retail ecommerce consumer fmcg shopping goods",
  },
  {
    value: "Professional Services",
    label: "Professional Services",
    keywords: "consulting legal accounting advisory agency services",
  },
  {
    value: "Education",
    label: "Education",
    keywords: "education school university academic training edtech",
  },
  {
    value: "Government & Public Sector",
    label: "Government & Public Sector",
    keywords: "government public sector civic municipal agency state",
  },
  {
    value: "Energy & Utilities",
    label: "Energy & Utilities",
    keywords: "energy utilities oil gas power renewable electricity water",
  },
  {
    value: "Construction & Real Estate",
    label: "Construction & Real Estate",
    keywords: "construction real estate property building infrastructure",
  },
  {
    value: "Transportation & Logistics",
    label: "Transportation & Logistics",
    keywords: "transport logistics shipping freight supply chain mobility",
  },
  {
    value: "Media & Entertainment",
    label: "Media & Entertainment",
    keywords: "media entertainment publishing gaming music film content",
  },
  {
    value: "Hospitality & Travel",
    label: "Hospitality & Travel",
    keywords: "hospitality travel tourism hotel restaurant leisure",
  },
  {
    value: "Telecommunications",
    label: "Telecommunications",
    keywords: "telecom telecommunications mobile network carrier isp",
  },
  {
    value: "Nonprofit",
    label: "Nonprofit",
    keywords: "nonprofit ngo charity foundation social impact",
  },
  {
    value: "Agriculture",
    label: "Agriculture",
    keywords: "agriculture farming agtech food crops livestock",
  },
  {
    value: "Other",
    label: "Other",
    keywords: "other misc miscellaneous unlisted",
  },
];
