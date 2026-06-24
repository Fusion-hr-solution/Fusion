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
      "bg-[hsl(var(--ey-blue-500))]/10 text-[hsl(var(--ey-blue-500))] border-[hsl(var(--ey-blue-500))]/20",
    chartColor: "hsl(var(--ey-blue-500))",
  },
  OnSite: {
    label: "In-Person",
    shortLabel: "On-Site",
    icon: Building2,
    badgeClass:
      "bg-[hsl(var(--ey-teal-500))]/10 text-[hsl(var(--ey-teal-500))] border-[hsl(var(--ey-teal-500))]/20",
    chartColor: "hsl(var(--ey-teal-500))",
  },
};

export const TRAINING_TYPE_OPTIONS: Array<{ value: TrainingType | "all"; label: string }> = [
  { value: "all", label: "All formats" },
  { value: "ELearning", label: "E-Learning" },
  { value: "OnSite", label: "In-Person" },
];
