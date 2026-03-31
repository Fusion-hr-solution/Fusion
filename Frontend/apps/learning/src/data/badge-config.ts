import type { BadgeLevel } from "@/types";

export const BADGE_LEVEL_CONFIG: Record<
  BadgeLevel,
  { label: string; className: string }
> = {
  bronze: {
    label: "Bronze",
    className: "text-zinc-600 bg-zinc-100 border-zinc-200",
  },
  silver: {
    label: "Silver",
    className: "text-zinc-600 bg-zinc-100 border-zinc-200",
  },
  gold: {
    label: "Gold",
    className: "text-zinc-600 bg-zinc-100 border-zinc-200",
  },
};
