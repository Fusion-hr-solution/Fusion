"use client";

import { Card, CardContent } from "@repo/ui";
import { Clock, BookOpen, Users, Star, ArrowUpRight, AlertTriangle, Award } from "lucide-react";
import type { TrainingCardProps } from "@/types/component-props";
import { CATEGORY_CONFIG, LEVEL_CONFIG } from "@/data/categories";
import { BADGE_LEVEL_CONFIG } from "@/data/badge-config";

export function TrainingCard({ training, onSelect }: TrainingCardProps) {
  const category = CATEGORY_CONFIG[training.category];
  const level = LEVEL_CONFIG[training.level];
  const badge = BADGE_LEVEL_CONFIG[training.badgeLevel];

  return (
    <Card
      className="group relative flex flex-col overflow-hidden border border-border/60 bg-card transition-all duration-300 hover:shadow-xl hover:shadow-black/8 hover:-translate-y-1 cursor-pointer"
      role="button"
      tabIndex={0}
      aria-label={`View details for ${training.title}`}
      onClick={() => onSelect(training)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onSelect(training);
        }
      }}
    >
      {/* Category color strip with entrance animation */}
      <div className={`h-1 w-full ey-animate-stripe ${category.stripClass}`} />

      <CardContent className="flex flex-1 flex-col gap-4 p-5">
        {/* Top — category + level + mandatory */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <span
              className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold tracking-wide uppercase shrink-0 ${category.badgeClass}`}
            >
              {category.label}
            </span>
            {training.isMandatory && (
              <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 border border-amber-200 px-2 py-0.5 text-xs font-semibold text-amber-700 shrink-0">
                <AlertTriangle className="h-3 w-3" aria-hidden="true" />
                Mandatory
              </span>
            )}
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <span className={`h-1.5 w-1.5 rounded-full ${level.dotClass}`} />
              {level.label}
            </span>
            <ArrowUpRight
              className="h-3.5 w-3.5 text-muted-foreground/0 transition-all duration-300 group-hover:text-[hsl(var(--ey-blue-600))] group-hover:translate-x-0.5 group-hover:-translate-y-0.5"
              aria-hidden="true"
            />
          </div>
        </div>

        {/* Title */}
        <h3 className="text-sm font-semibold leading-snug text-foreground line-clamp-2 group-hover:text-[hsl(var(--ey-blue-600))] transition-colors duration-200">
          {training.title}
        </h3>

        {/* Description */}
        <p className="text-sm leading-relaxed text-muted-foreground line-clamp-2 flex-1">
          {training.description}
        </p>

        {/* Meta row — pill style */}
        <div className="flex items-center gap-2 text-xs text-muted-foreground flex-wrap">
          <span className="flex items-center gap-1.5 rounded-md bg-[hsl(var(--ey-grey-100))] px-2 py-1">
            <Clock className="h-3.5 w-3.5" aria-hidden="true" />
            {training.duration}
          </span>
          <span className="flex items-center gap-1.5 rounded-md bg-[hsl(var(--ey-grey-100))] px-2 py-1">
            <BookOpen className="h-3.5 w-3.5" aria-hidden="true" />
            {training.chaptersCount} chapters
          </span>
          <span className={`flex items-center gap-1.5 rounded-md border px-2 py-1 ${badge.className}`}>
            <Award className="h-3.5 w-3.5" aria-hidden="true" />
            {badge.label}
          </span>
          <span className="flex items-center gap-1.5 rounded-md bg-[hsl(var(--ey-grey-100))] px-2 py-1 font-semibold">
            {training.credits} credits
          </span>
        </div>

        {/* Bottom — instructor + stats */}
        <div className="flex items-center justify-between border-t border-border/40 pt-3.5">
          <div className="flex items-center gap-2.5">
            <div className="flex h-7 w-7 items-center justify-center rounded-full ey-bg-dark text-xs font-semibold text-white ring-2 ring-[hsl(var(--ey-grey-200))] transition-all duration-300 group-hover:ring-[hsl(var(--ey-yellow))]/40">
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
              <Star className="h-3 w-3 ey-star" aria-hidden="true" />
              <span className="font-semibold text-foreground">{training.rating}</span>
            </span>
            <span className="flex items-center gap-1">
              <Users className="h-3 w-3" aria-hidden="true" />
              {training.enrolledCount.toLocaleString()}
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
