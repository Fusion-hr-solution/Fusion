"use client";

import {
  Button,
  Badge,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@repo/ui";
import { CalendarDays, ChevronRight, User } from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";
import type { TrainingDetailDialogProps } from "@/types/component-props";
import { CATEGORY_CONFIG, LEVEL_CONFIG } from "@/data/categories";
import { TrainingStatsStrip } from "./training-stats-strip";
import { CourseOutline } from "./course-outline";

export function TrainingDetailDialog({
  training,
  open,
  onOpenChange,
}: TrainingDetailDialogProps) {
  const t = useTranslations("trainingDetail");
  const tCommon = useTranslations("common");
  const format = useFormatter();
  if (!training) return null;

  const category = CATEGORY_CONFIG[training.category];
  const level = LEVEL_CONFIG[training.level];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto p-0 gap-0">
        {/* Header accent — gradient band */}
        <div className="relative shrink-0">
          <div className={`h-2 w-full ey-animate-stripe ${category.stripClass}`} />
          <div className={`absolute inset-x-0 bottom-0 h-1 ${category.stripClass} opacity-20 blur-sm`} />
        </div>

        <div className="p-6 pb-0">
          <DialogHeader className="space-y-3">
            {/* Category + Level row */}
            <div className="ey-animate-fade-in flex items-center gap-3">
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
            </div>

            <DialogTitle className="ey-animate-fade-up text-xl font-bold leading-tight text-foreground">
              {training.title}
            </DialogTitle>

            <DialogDescription
              className="ey-animate-fade-up text-sm leading-relaxed text-muted-foreground"
              style={{ animationDelay: "60ms" }}
            >
              {training.description}
            </DialogDescription>
          </DialogHeader>
        </div>

        {/* Stats strip */}
        <TrainingStatsStrip
          duration={training.duration}
          chaptersCount={training.chaptersCount}
          enrolledCount={training.enrolledCount}
          rating={training.rating}
        />

        {/* Instructor */}
        <div className="mx-6 mt-5 flex items-center gap-3.5 rounded-xl border border-border/60 bg-muted/50 p-4 transition-colors hover:border-[hsl(var(--ey-yellow))]/30">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full ey-bg-dark text-sm font-semibold text-white ring-2 ring-border">
            {training.instructor
              .split(" ")
              .map((n) => n[0])
              .join("")}
          </div>
          <div className="flex-1">
            <p className="text-sm font-semibold text-foreground">
              {training.instructor}
            </p>
            <p className="text-xs text-muted-foreground">
              {training.instructorRole}
            </p>
          </div>
          <User className="h-4 w-4 text-muted-foreground/40" aria-hidden="true" />
        </div>

        {/* Chapters */}
        <CourseOutline chapters={training.chapters} />

        {/* Tags */}
        <div className="mx-6 mt-5 flex flex-wrap gap-1.5">
          {training.tags.map((tag) => (
            <Badge
              key={tag}
              variant="secondary"
              className="rounded-full text-xs font-normal transition-colors hover:bg-muted"
            >
              {tag}
            </Badge>
          ))}
        </div>

        {/* Footer */}
        <div className="mx-6 mt-6 mb-6 flex items-center justify-between border-t border-border/40 pt-5">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <CalendarDays className="h-3.5 w-3.5" aria-hidden="true" />
            {t("updated", {
              date: format.dateTime(new Date(training.updatedAt), {
                month: "short",
                day: "numeric",
                year: "numeric",
              }),
            })}
          </div>
          <Button className="ey-bg-dark hover:ey-bg-dark-deep text-white gap-2 shadow-md transition-all hover:shadow-lg hover:gap-3">
            {t("enroll.enrollNow")}
            <ChevronRight className="h-4 w-4 transition-transform" aria-hidden="true" />
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
