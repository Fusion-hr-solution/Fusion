import type { CostType } from "@/types";

export interface CostTypeConfigEntry {
  label: string;
  badgeClass: string;
}

/** Internal (green, free) vs External (orange, paid) — only meaningful for OnSite trainings. */
export const COST_TYPE_CONFIG: Record<CostType, CostTypeConfigEntry> = {
  Internal: {
    label: "Internal",
    badgeClass:
      "border-[hsl(var(--ey-green-500))]/30 text-[hsl(var(--ey-green-500))] bg-[hsl(var(--ey-green-500))]/5",
  },
  External: {
    label: "External",
    badgeClass:
      "border-[hsl(var(--ey-orange-500))]/30 text-[hsl(var(--ey-orange-500))] bg-[hsl(var(--ey-orange-500))]/5",
  },
};
