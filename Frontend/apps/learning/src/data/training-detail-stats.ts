import { BookOpen, Clock, Coins, Star, Users } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { Training } from "@/types";

export interface TrainingStatItem {
  icon: LucideIcon;
  value: string;
  label: string;
  iconClass: string;
  bgClass: string;
}

export function getTrainingDetailStats(training: Training): TrainingStatItem[] {
  return [
    {
      icon: Clock,
      value: training.duration,
      label: "Total Duration",
      iconClass: "text-muted-foreground",
      bgClass: "bg-muted",
    },
    {
      icon: BookOpen,
      value: String(training.chaptersCount),
      label: "Chapters",
      iconClass: "text-muted-foreground",
      bgClass: "bg-muted",
    },
    {
      icon: Coins,
      value: String(training.credits),
      label: "Credits",
      iconClass: "text-muted-foreground",
      bgClass: "bg-muted",
    },
    {
      icon: Users,
      value: training.enrolledCount.toLocaleString(),
      label: "Enrolled",
      iconClass: "text-muted-foreground",
      bgClass: "bg-muted",
    },
    {
      icon: Star,
      value: String(training.rating),
      label: "Rating",
      iconClass: "text-muted-foreground",
      bgClass: "bg-muted",
    },
  ];
}
