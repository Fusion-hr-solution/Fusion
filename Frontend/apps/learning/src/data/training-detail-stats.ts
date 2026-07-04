import { BookOpen, Clock, Coins, Star, Users } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { Training } from "@/types";

export interface TrainingStatItem {
  icon: LucideIcon;
  value: string;
  /** Key under the `trainingDetail.stats` message namespace. */
  labelKey: "totalDuration" | "chapters" | "credits" | "enrolled" | "rating";
  iconClass: string;
  bgClass: string;
}

export function getTrainingDetailStats(training: Training): TrainingStatItem[] {
  return [
    {
      icon: Clock,
      value: training.duration,
      labelKey: "totalDuration",
      iconClass: "text-muted-foreground",
      bgClass: "bg-muted",
    },
    {
      icon: BookOpen,
      value: String(training.chaptersCount),
      labelKey: "chapters",
      iconClass: "text-muted-foreground",
      bgClass: "bg-muted",
    },
    {
      icon: Coins,
      value: String(training.credits),
      labelKey: "credits",
      iconClass: "text-muted-foreground",
      bgClass: "bg-muted",
    },
    {
      icon: Users,
      // Deterministic across server/client. `toLocaleString()` with no explicit
      // locale uses the runtime default (Node = en-US, browser = user locale),
      // which differs and breaks hydration on this server-rendered page.
      value: String(training.enrolledCount),
      labelKey: "enrolled",
      iconClass: "text-muted-foreground",
      bgClass: "bg-muted",
    },
    {
      icon: Star,
      value: training.rating != null ? training.rating.toFixed(1) : "—",
      labelKey: "rating",
      iconClass: "text-muted-foreground",
      bgClass: "bg-muted",
    },
  ];
}
