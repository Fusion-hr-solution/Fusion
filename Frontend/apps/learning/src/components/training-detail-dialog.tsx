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
import {
  Clock,
  BookOpen,
  Users,
  Star,
  CalendarDays,
  ChevronRight,
} from "lucide-react";
import type { TrainingDetailDialogProps } from "@/types/component-props";
import { CATEGORY_CONFIG, LEVEL_CONFIG } from "@/data/categories";

export function TrainingDetailDialog({
  training,
  open,
  onOpenChange,
}: TrainingDetailDialogProps) {
  if (!training) return null;

  const category = CATEGORY_CONFIG[training.category];
  const level = LEVEL_CONFIG[training.level];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto p-0 gap-0">
        {/* Header accent */}
        <div className={`h-1.5 w-full shrink-0 ${category.stripClass}`} />

        <div className="p-6 pb-0">
          <DialogHeader className="space-y-3">
            {/* Category + Level row */}
            <div className="flex items-center gap-3">
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
            </div>

            <DialogTitle className="text-xl font-bold leading-tight text-foreground">
              {training.title}
            </DialogTitle>

            <DialogDescription className="text-sm leading-relaxed text-muted-foreground">
              {training.description}
            </DialogDescription>
          </DialogHeader>
        </div>

        {/* Stats strip */}
        <div className="mx-6 mt-5 grid grid-cols-4 gap-3 rounded-lg bg-[hsl(var(--ey-grey-100))] p-4">
          <div className="flex flex-col items-center gap-1">
            <Clock className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-semibold text-foreground">
              {training.duration}
            </span>
            <span className="text-[11px] text-muted-foreground">Duration</span>
          </div>
          <div className="flex flex-col items-center gap-1">
            <BookOpen className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-semibold text-foreground">
              {training.chaptersCount}
            </span>
            <span className="text-[11px] text-muted-foreground">Chapters</span>
          </div>
          <div className="flex flex-col items-center gap-1">
            <Users className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-semibold text-foreground">
              {training.enrolledCount.toLocaleString()}
            </span>
            <span className="text-[11px] text-muted-foreground">Enrolled</span>
          </div>
          <div className="flex flex-col items-center gap-1">
            <Star className="h-4 w-4 ey-star" />
            <span className="text-sm font-semibold text-foreground">
              {training.rating}
            </span>
            <span className="text-[11px] text-muted-foreground">Rating</span>
          </div>
        </div>

        {/* Instructor */}
        <div className="mx-6 mt-5 flex items-center gap-3 rounded-lg border border-border/60 p-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full ey-bg-dark text-sm font-semibold text-white">
            {training.instructor
              .split(" ")
              .map((n) => n[0])
              .join("")}
          </div>
          <div>
            <p className="text-sm font-semibold text-foreground">
              {training.instructor}
            </p>
            <p className="text-xs text-muted-foreground">
              {training.instructorRole}
            </p>
          </div>
        </div>

        {/* Chapters */}
        <div className="mx-6 mt-5">
          <h4 className="mb-3 text-sm font-semibold text-foreground">
            Course Outline
          </h4>
          <div className="space-y-1">
            {training.chapters.map((chapter, i) => (
              <div
                key={chapter.id}
                className="flex items-center justify-between rounded-md px-3 py-2.5 text-sm transition-colors hover:bg-[hsl(var(--ey-grey-100))]"
              >
                <div className="flex items-center gap-3">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[hsl(var(--ey-grey-200))] text-[11px] font-semibold text-muted-foreground">
                    {i + 1}
                  </span>
                  <span className="text-foreground">{chapter.title}</span>
                </div>
                <span className="text-xs text-muted-foreground">
                  {chapter.duration}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Tags */}
        <div className="mx-6 mt-5 flex flex-wrap gap-1.5">
          {training.tags.map((tag) => (
            <Badge
              key={tag}
              variant="secondary"
              className="rounded-full text-[11px] font-normal"
            >
              {tag}
            </Badge>
          ))}
        </div>

        {/* Footer */}
        <div className="mx-6 mt-5 mb-6 flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <CalendarDays className="h-3.5 w-3.5" />
            Updated{" "}
            {new Date(training.updatedAt).toLocaleDateString("en-US", {
              month: "short",
              day: "numeric",
              year: "numeric",
            })}
          </div>
          <Button className="ey-bg-dark hover:ey-bg-dark-deep text-white gap-2">
            Enroll Now
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
