"use client";

import { Clock, BookOpen, Users, Star } from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";
import type { TrainingStatsStripProps } from "@/types/component-props";

export function TrainingStatsStrip({
  duration,
  chaptersCount,
  enrolledCount,
  rating,
}: TrainingStatsStripProps) {
  const t = useTranslations("trainingDetail.stats");
  const format = useFormatter();
  const stats = [
    {
      icon: Clock,
      value: duration,
      labelKey: "duration",
      className: "text-muted-foreground",
    },
    {
      icon: BookOpen,
      value: String(chaptersCount),
      labelKey: "chapters",
      className: "text-muted-foreground",
    },
    {
      icon: Users,
      value: format.number(enrolledCount),
      labelKey: "enrolled",
      className: "text-muted-foreground",
    },
    {
      icon: Star,
      value: String(rating),
      labelKey: "rating",
      className: "ey-star",
    },
  ] as const;

  return (
    <div className="mx-6 mt-5 grid grid-cols-4 gap-2 rounded-xl bg-muted/50 border border-border/40 p-4">
      {stats.map((stat) => {
        const Icon = stat.icon;
        return (
          <div
            key={stat.labelKey}
            className="flex flex-col items-center gap-1.5 text-center"
          >
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-card shadow-sm">
              <Icon
                className={`h-4 w-4 ${stat.className}`}
                aria-hidden="true"
              />
            </div>
            <span className="text-sm font-bold text-foreground tabular-nums">
              {stat.value}
            </span>
            <span className="text-xs text-muted-foreground">
              {t(stat.labelKey)}
            </span>
          </div>
        );
      })}
    </div>
  );
}
