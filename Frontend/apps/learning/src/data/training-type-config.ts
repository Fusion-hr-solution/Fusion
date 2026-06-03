import { Laptop, Building2, type LucideIcon } from "lucide-react";
import type { TrainingType } from "@/types";

export interface TrainingTypeConfigEntry {
  label: string;
  shortLabel: string;
  icon: LucideIcon;
  /** Tailwind classes for the badge pill (background + text + border). */
  badgeClass: string;
  /** Solid color used by chart slices and progress accents (HSL string). */
  chartColor: string;
}

export const TRAINING_TYPE_CONFIG: Record<TrainingType, TrainingTypeConfigEntry> = {
  ELearning: {
    label: "E-Learning",
    shortLabel: "Online",
    icon: Laptop,
    badgeClass:
      "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-900",
    chartColor: "hsl(217, 91%, 60%)",
  },
  OnSite: {
    label: "In-Person",
    shortLabel: "On-Site",
    icon: Building2,
    badgeClass:
      "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-900",
    chartColor: "hsl(160, 84%, 39%)",
  },
};

export const TRAINING_TYPE_OPTIONS: Array<{ value: TrainingType | "all"; label: string }> = [
  { value: "all", label: "All formats" },
  { value: "ELearning", label: "E-Learning" },
  { value: "OnSite", label: "In-Person" },
];
