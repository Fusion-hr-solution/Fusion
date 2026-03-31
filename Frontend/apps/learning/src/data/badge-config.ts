import type { BadgeLevel } from "@/types";

export const BADGE_LEVEL_CONFIG: Record<
  BadgeLevel,
  { label: string; className: string }
> = {
  bronze: {
    label: "Bronze",
    className: "text-[hsl(var(--ey-orange-500))] bg-[hsl(var(--ey-orange-500))]/10 border-[hsl(var(--ey-orange-500))]/25",
  },
  silver: {
    label: "Silver",
    className: "text-[hsl(var(--ey-grey-500))] bg-[hsl(var(--ey-grey-100))] border-[hsl(var(--ey-grey-200))]",
  },
  gold: {
    label: "Gold",
    className: "ey-text-accent bg-[hsl(var(--ey-yellow))]/10 border-[hsl(var(--ey-yellow))]/30",
  },
};
