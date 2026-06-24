import type { BadgeLevel } from "@/types";

export const BADGE_LEVEL_CONFIG: Record<
  BadgeLevel,
  { label: string; className: string }
> = {
  bronze: {
    label: "Bronze",
    className:
      "text-[hsl(var(--ey-orange-500))] bg-[hsl(var(--ey-orange-500))]/10 border-[hsl(var(--ey-orange-500))]/25",
  },
  silver: {
    label: "Silver",
    className: "text-muted-foreground bg-muted border-border",
  },
  gold: {
    label: "Gold",
    className:
      "text-[hsl(var(--chart-3))] bg-[hsl(var(--chart-3))]/12 border-[hsl(var(--chart-3))]/30",
  },
};
