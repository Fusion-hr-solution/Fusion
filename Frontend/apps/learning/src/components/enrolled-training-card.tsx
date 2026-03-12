"use client";

import { Card, CardContent } from "@repo/ui";
import { Clock, Star, CalendarDays } from "lucide-react";
import type { EnrolledTrainingCardProps } from "@/types/component-props";
import { CATEGORY_CONFIG, LEVEL_CONFIG } from "@/data/categories";
import { STATUS_CONFIG } from "@/data/status-config";
import { TrainingProgressBar } from "./training-progress-bar";

function formatLocalDate(
  dateStr: string,
  options: Intl.DateTimeFormatOptions
): string {
  const parts = dateStr.split("-").map(Number);
  return new Date(parts[0]!, parts[1]! - 1, parts[2]).toLocaleDateString(
    "en-US",
    options
  );
}

export function EnrolledTrainingCard({
  training,
  onContinue,
}: EnrolledTrainingCardProps) {
  const category = CATEGORY_CONFIG[training.category];
  const level = LEVEL_CONFIG[training.level];
  const status = STATUS_CONFIG[training.status];
  const StatusIcon = status.icon;

  return (
    <Card className="group overflow-hidden border border-border/60 bg-card transition-all duration-300 hover:shadow-lg hover:shadow-black/5">
      {/* Category strip */}
      <div className={`h-1 w-full ${category.stripClass}`} />

      <CardContent className="p-5">
        <div className="flex gap-5">
          {/* Left content */}
          <div className="flex flex-1 flex-col gap-3">
            {/* Top meta row */}
            <div className="flex flex-wrap items-center gap-2">
              <span
                className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold tracking-wide uppercase ${category.badgeClass}`}
              >
                {category.label}
              </span>
              <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <span
                  className={`h-1.5 w-1.5 rounded-full ${level.dotClass}`}
                />
                {level.label}
              </span>
              <span
                className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold ${status.className}`}
              >
                <StatusIcon className="h-3 w-3" />
                {status.label}
              </span>
            </div>

            {/* Title */}
            <h3 className="text-sm font-semibold leading-snug text-foreground line-clamp-1">
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
            <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
              <span className="flex items-center gap-1">
                <Clock className="h-3.5 w-3.5" />
                {training.duration}
              </span>
              <span className="flex items-center gap-1">
                <Star className="h-3 w-3 ey-star" />
                {training.rating}
              </span>
              {training.deadline && (
                <span className="flex items-center gap-1">
                  <CalendarDays className="h-3.5 w-3.5" />
                  Due{" "}
                  {formatLocalDate(training.deadline, {
                    month: "short",
                    day: "numeric",
                  })}
                </span>
              )}
            </div>

            {/* Instructor */}
            <div className="flex items-center gap-2">
              <div className="flex h-6 w-6 items-center justify-center rounded-full ey-bg-dark text-[10px] font-semibold text-white">
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
          <div className="flex flex-col items-end justify-between">
            {training.completedAt && (
              <span className="text-xs text-muted-foreground">
                {formatLocalDate(training.completedAt, {
                  month: "short",
                  day: "numeric",
                  year: "numeric",
                })}
              </span>
            )}
            <button
              onClick={() => onContinue(training)}
              className={`rounded-md px-4 py-2 text-xs font-semibold transition-all ${status.buttonClass}`}
            >
              {status.buttonLabel}
            </button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
