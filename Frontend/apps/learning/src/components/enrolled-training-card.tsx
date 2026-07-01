"use client";

import { Card, CardContent } from "@repo/ui";
import { Clock, Star, CalendarDays, ChevronRight } from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";
import type { EnrolledTrainingCardProps } from "@/types/component-props";
import { CATEGORY_CONFIG, LEVEL_CONFIG } from "@/data/categories";
import { STATUS_CONFIG } from "@/data/status-config";
import { TrainingProgressBar } from "./training-progress-bar";

/** Parses a date-only string ("YYYY-MM-DD") as a local date, not UTC. */
function parseLocalDate(dateStr: string): Date {
  const parts = dateStr.split("-").map(Number);
  return new Date(parts[0]!, parts[1]! - 1, parts[2]);
}

export function EnrolledTrainingCard({
  training,
  onContinue,
}: EnrolledTrainingCardProps) {
  const t = useTranslations("myTrainings");
  const tCommon = useTranslations("common");
  const format = useFormatter();
  const category = CATEGORY_CONFIG[training.category];
  const level = LEVEL_CONFIG[training.level];
  const status = STATUS_CONFIG[training.status];
  const StatusIcon = status.icon;

  return (
    <Card className="group overflow-hidden border border-border/60 bg-card transition-all duration-300 hover:shadow-lg hover:shadow-black/5 hover:border-border">
      {/* Category strip with animation */}
      <div className={`h-1 w-full ey-animate-stripe ${category.stripClass}`} />

      <CardContent className="p-5">
        <div className="flex gap-5">
          {/* Left content */}
          <div className="flex flex-1 flex-col gap-3">
            {/* Top meta row */}
            <div className="flex flex-wrap items-center gap-2">
              <span
                className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold tracking-wide uppercase ${category.badgeClass}`}
              >
                {tCommon(`category.${training.category}`)}
              </span>
              <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <span
                  className={`h-1.5 w-1.5 rounded-full ${level.dotClass}`}
                />
                {tCommon(`level.${training.level}`)}
              </span>
              <span
                className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold ${status.className}`}
              >
                <StatusIcon className="h-3 w-3" aria-hidden="true" />
                {tCommon(`status.${training.status}`)}
              </span>
            </div>

            {/* Title */}
            <h3 className="text-sm font-semibold leading-snug text-foreground line-clamp-1 group-hover:text-[hsl(var(--ey-blue-600))] transition-colors">
              {training.title}
            </h3>

            {/* Enhanced progress visualization */}
            <TrainingProgressBar
              progress={training.progress}
              currentChapter={training.currentChapter}
              totalChapters={training.chaptersCount}
              size="md"
            />

            {/* Meta */}
            <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
              <span className="flex items-center gap-1.5 rounded-md bg-muted px-2 py-1">
                <Clock className="h-3.5 w-3.5" aria-hidden="true" />
                {training.duration}
              </span>
              <span className="flex items-center gap-1.5 rounded-md bg-muted px-2 py-1">
                <Star className="h-3 w-3 ey-star" aria-hidden="true" />
                {training.rating}
              </span>
              {training.deadline && (
                <span className="flex items-center gap-1.5 rounded-md bg-muted px-2 py-1">
                  <CalendarDays className="h-3.5 w-3.5" aria-hidden="true" />
                  {t("due", {
                    date: format.dateTime(parseLocalDate(training.deadline), {
                      month: "short",
                      day: "numeric",
                    }),
                  })}
                </span>
              )}
            </div>

            {/* Instructor */}
            <div className="flex items-center gap-2">
              <div className="flex h-6 w-6 items-center justify-center rounded-full ey-bg-dark text-xs font-semibold text-white ring-1 ring-border">
                {training.instructor
                  .split(" ")
                  .map((n) => n[0])
                  .join("")}
              </div>
              <span className="text-xs text-muted-foreground">
                {training.instructor}
              </span>
            </div>
          </div>

          {/* Right action */}
          <div className="flex flex-col items-end justify-between gap-3">
            {training.completedAt && (
              <span className="text-xs text-muted-foreground">
                {format.dateTime(parseLocalDate(training.completedAt), {
                  month: "short",
                  day: "numeric",
                  year: "numeric",
                })}
              </span>
            )}
            <button
              onClick={() => onContinue(training)}
              className={`group/btn flex items-center gap-1.5 rounded-lg px-4 py-2 text-xs font-semibold transition-all shadow-sm hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 ${status.buttonClass}`}
            >
              {tCommon(`statusAction.${training.status}`)}
              <ChevronRight
                className="h-3.5 w-3.5 transition-transform group-hover/btn:translate-x-0.5"
                aria-hidden="true"
              />
            </button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
