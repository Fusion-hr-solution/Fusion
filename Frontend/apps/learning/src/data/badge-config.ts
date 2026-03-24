import type { BadgeLevel } from "@/types";

export const BADGE_LEVEL_CONFIG: Record<
  BadgeLevel,
  { label: string; className: string }
> = {
  bronze: {
    label: "Bronze",
    className: "text-orange-700 bg-orange-100 border-orange-200",
  },
  silver: {
    label: "Silver",
    className: "text-slate-600 bg-slate-100 border-slate-200",
  },
  gold: {
    label: "Gold",
    className: "text-yellow-700 bg-yellow-50 border-yellow-200",
  },
};
