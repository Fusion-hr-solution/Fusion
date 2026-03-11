"use client";

import { Card, CardContent } from "@repo/ui";
import {
  Clock,
  BookOpen,
  Star,
  CalendarDays,
  Play,
  CheckCircle2,
  CircleDashed,
} from "lucide-react";
import type { EnrolledTrainingCardProps } from "@/types/component-props";
import { CATEGORY_CONFIG, LEVEL_CONFIG } from "@/data/categories";
import { TrainingProgressBar } from "./training-progress-bar";

export function EnrolledTrainingCard({
  training,
  onContinue,
}: EnrolledTrainingCardProps) {
  const category = CATEGORY_CONFIG[training.category];
  const level = LEVEL_CONFIG[training.level];

  const statusConfig = {
    "in-progress": {
      icon: Play,
      label: "In Progress",
      className:
        "bg-[hsl(var(--ey-blue-400))]/10 text-[hsl(var(--ey-blue-600))]",
      buttonLabel: "Continue",
      buttonClass: "ey-bg-dark hover:bg-[hsl(var(--ey-black))] text-white",
    },
    completed: {
      icon: CheckCircle2,
      label: "Completed",
      className:
        "bg-[hsl(var(--ey-green-500))]/10 text-[hsl(var(--ey-green-500))]",
      buttonLabel: "Review",
      buttonClass:
        "border border-border bg-white text-foreground hover:bg-[hsl(var(--ey-grey-100))]",
    },
    "not-started": {
      icon: CircleDashed,
      label: "Not Started",
      className: "bg-[hsl(var(--ey-grey-200))] text-[hsl(var(--ey-grey-400))]",
      buttonLabel: "Start",
      buttonClass:
        "ey-bg-accent text-[hsl(var(--ey-grey-500))] hover:opacity-90",
    },
  };

  const status = statusConfig[training.status];
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
                className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-semibold tracking-wide uppercase ${category.badgeClass}`}
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
                className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ${status.className}`}
              >
                <StatusIcon className="h-3 w-3" />
                {status.label}
              </span>
            </div>

            {/* Title */}
            <h3 className="text-[15px] font-semibold leading-snug text-foreground line-clamp-1">
              {training.title}
            </h3>

            {/* Progress */}
            <div className="flex items-center gap-3">
              <div className="flex-1">
                <TrainingProgressBar progress={training.progress} size="sm" />
              </div>
              <span className="text-[12px] font-semibold text-foreground tabular-nums">
                {training.progress}%
              </span>
            </div>

            {/* Meta */}
            <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
              <span className="flex items-center gap-1">
                <BookOpen className="h-3.5 w-3.5" />
                {training.currentChapter}/{training.chaptersCount} chapters
              </span>
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
                  {new Date(training.deadline).toLocaleDateString("en-US", {
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
              <span className="text-[11px] text-muted-foreground">
                {new Date(training.completedAt).toLocaleDateString("en-US", {
                  month: "short",
                  day: "numeric",
                  year: "numeric",
                })}
              </span>
            )}
            <button
              onClick={() => onContinue(training)}
              className={`rounded-md px-4 py-2 text-[13px] font-semibold transition-all ${status.buttonClass}`}
            >
              {status.buttonLabel}
            </button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
