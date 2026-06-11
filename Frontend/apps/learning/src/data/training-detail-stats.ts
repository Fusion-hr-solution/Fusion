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
      value: training.enrolledCount.toLocaleString(),
      labelKey: "enrolled",
      iconClass: "text-muted-foreground",
      bgClass: "bg-muted",
    },
    {
      icon: Star,
      value: String(training.rating),
      labelKey: "rating",
      iconClass: "text-muted-foreground",
      bgClass: "bg-muted",
    },
  ];
}
