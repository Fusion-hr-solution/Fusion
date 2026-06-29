import type { BadgeLevel } from "@/types";

export const BADGE_LEVEL_CONFIG: Record<
  BadgeLevel,
  { label: string; className: string }
> = {
  bronze: {
    label: "Bronze",
    className: "text-muted-foreground bg-muted border-border",
  },
  silver: {
    label: "Silver",
    className: "text-muted-foreground bg-muted border-border",
  },
  gold: {
    label: "Gold",
    className: "text-muted-foreground bg-muted border-border",
  },
};
