"use client";

import { Card, CardContent } from "@repo/ui";
import { Clock, BookOpen, Users, Star } from "lucide-react";
import type { TrainingCardProps } from "@/types/component-props";
import { CATEGORY_CONFIG, LEVEL_CONFIG } from "@/data/categories";

export function TrainingCard({ training, onSelect }: TrainingCardProps) {
  const category = CATEGORY_CONFIG[training.category];
  const level = LEVEL_CONFIG[training.level];

  return (
    <Card
      className="group relative flex flex-col overflow-hidden border border-border/60 bg-card transition-all duration-300 hover:shadow-lg hover:shadow-black/5 hover:-translate-y-0.5 cursor-pointer"
      onClick={() => onSelect(training)}
    >
      {/* Category color strip */}
      <div className={`h-1 w-full ${category.stripClass}`} />

      <CardContent className="flex flex-1 flex-col gap-4 p-5">
        {/* Top — category + level */}
        <div className="flex items-center justify-between gap-2">
          <span
            className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-semibold tracking-wide uppercase ${category.badgeClass}`}
          >
            {category.label}
          </span>
          <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <span className={`h-1.5 w-1.5 rounded-full ${level.dotClass}`} />
            {level.label}
          </span>
        </div>

        {/* Title */}
        <h3 className="text-[15px] font-semibold leading-snug text-foreground line-clamp-2 group-hover:text-[hsl(var(--ey-blue-600))] transition-colors">
          {training.title}
        </h3>

        {/* Description */}
        <p className="text-[13px] leading-relaxed text-muted-foreground line-clamp-2 flex-1">
          {training.description}
        </p>

        {/* Meta row */}
        <div className="flex items-center gap-4 text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            <Clock className="h-3.5 w-3.5" />
            {training.duration}
          </span>
          <span className="flex items-center gap-1">
            <BookOpen className="h-3.5 w-3.5" />
            {training.chaptersCount} chapters
          </span>
        </div>

        {/* Bottom — instructor + stats */}
        <div className="flex items-center justify-between border-t border-border/50 pt-3">
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-full ey-bg-dark text-[11px] font-semibold text-white">
              {training.instructor
                .split(" ")
                .map((n) => n[0])
                .join("")}
            </div>
            <span className="text-xs font-medium text-foreground">
              {training.instructor}
            </span>
          </div>
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <Star className="h-3 w-3 ey-star" />
              {training.rating}
            </span>
            <span className="flex items-center gap-1">
              <Users className="h-3 w-3" />
              {training.enrolledCount.toLocaleString()}
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
