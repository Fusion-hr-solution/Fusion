import { Clock, BookOpen, Users, Star } from "lucide-react";
import type { TrainingStatsStripProps } from "@/types/component-props";

export function TrainingStatsStrip({
  duration,
  chaptersCount,
  enrolledCount,
  rating,
}: TrainingStatsStripProps) {
  const stats = [
    { icon: Clock, value: duration, label: "Duration", className: "text-muted-foreground" },
    { icon: BookOpen, value: String(chaptersCount), label: "Chapters", className: "text-muted-foreground" },
    { icon: Users, value: enrolledCount.toLocaleString(), label: "Enrolled", className: "text-muted-foreground" },
    { icon: Star, value: String(rating), label: "Rating", className: "ey-star" },
  ];

  return (
    <div className="mx-6 mt-5 grid grid-cols-4 gap-2 rounded-xl bg-[hsl(var(--ey-grey-50))] border border-border/40 p-4">
      {stats.map((stat) => {
        const Icon = stat.icon;
        return (
          <div key={stat.label} className="flex flex-col items-center gap-1.5 text-center">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-white shadow-sm">
              <Icon className={`h-4 w-4 ${stat.className}`} aria-hidden="true" />
            </div>
            <span className="text-sm font-bold text-foreground tabular-nums">
              {stat.value}
            </span>
            <span className="text-xs text-muted-foreground">{stat.label}</span>
          </div>
        );
      })}
    </div>
  );
}
