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
      iconClass: "text-[hsl(var(--ey-grey-400))]",
      bgClass: "bg-[hsl(var(--ey-grey-100))]",
    },
    {
      icon: BookOpen,
      value: String(training.chaptersCount),
      label: "Chapters",
      iconClass: "text-[hsl(var(--ey-grey-400))]",
      bgClass: "bg-[hsl(var(--ey-grey-100))]",
    },
    {
      icon: Coins,
      value: String(training.credits),
      label: "Credits",
      iconClass: "text-[hsl(var(--ey-grey-400))]",
      bgClass: "bg-[hsl(var(--ey-grey-100))]",
    },
    {
      icon: Users,
      value: training.enrolledCount.toLocaleString(),
      label: "Enrolled",
      iconClass: "text-[hsl(var(--ey-grey-400))]",
      bgClass: "bg-[hsl(var(--ey-grey-100))]",
    },
    {
      icon: Star,
      value: String(training.rating),
      label: "Rating",
      iconClass: "text-[hsl(var(--ey-grey-400))]",
      bgClass: "bg-[hsl(var(--ey-grey-100))]",
    },
  ];
}
