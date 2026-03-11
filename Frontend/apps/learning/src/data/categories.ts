import type { TrainingCategory, TrainingLevel } from "@/types";

export const CATEGORY_CONFIG: Record<
  TrainingCategory,
  {
    label: string;
    badgeClass: string;
    chipClass: string;
    stripClass: string;
  }
> = {
  leadership: {
    label: "Leadership",
    badgeClass: "ey-cat-leadership",
    chipClass: "ey-chip-leadership",
    stripClass: "ey-strip-leadership",
  },
  technical: {
    label: "Technical",
    badgeClass: "ey-cat-technical",
    chipClass: "ey-chip-technical",
    stripClass: "ey-strip-technical",
  },
  compliance: {
    label: "Compliance",
    badgeClass: "ey-cat-compliance",
    chipClass: "ey-chip-compliance",
    stripClass: "ey-strip-compliance",
  },
  "soft-skills": {
    label: "Soft Skills",
    badgeClass: "ey-cat-soft-skills",
    chipClass: "ey-chip-soft-skills",
    stripClass: "ey-strip-soft-skills",
  },
  finance: {
    label: "Finance",
    badgeClass: "ey-cat-finance",
    chipClass: "ey-chip-finance",
    stripClass: "ey-strip-finance",
  },
  "data-analytics": {
    label: "Data & Analytics",
    badgeClass: "ey-cat-data-analytics",
    chipClass: "ey-chip-data-analytics",
    stripClass: "ey-strip-data-analytics",
  },
};

export const LEVEL_CONFIG: Record<
  TrainingLevel,
  { label: string; dotClass: string }
> = {
  beginner: { label: "Beginner", dotClass: "ey-dot-beginner" },
  intermediate: { label: "Intermediate", dotClass: "ey-dot-intermediate" },
  advanced: { label: "Advanced", dotClass: "ey-dot-advanced" },
};
