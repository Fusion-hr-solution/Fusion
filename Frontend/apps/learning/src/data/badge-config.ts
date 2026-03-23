import type { BadgeLevel } from "@/types";

export const BADGE_LEVEL_CONFIG: Record<
  BadgeLevel,
  { label: string; icon: string; className: string; bgClass: string }
> = {
  bronze: {
    label: "Bronze",
    icon: "🥉",
    className: "text-orange-700 bg-orange-100 border-orange-200",
    bgClass: "bg-orange-100",
  },
  silver: {
    label: "Silver",
    icon: "🥈",
    className: "text-slate-600 bg-slate-100 border-slate-200",
    bgClass: "bg-slate-100",
  },
  gold: {
    label: "Gold",
    icon: "🥇",
    className: "text-yellow-700 bg-yellow-50 border-yellow-200",
    bgClass: "bg-yellow-50",
  },
};
