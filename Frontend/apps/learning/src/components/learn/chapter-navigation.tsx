"use client";

import { Button } from "@repo/ui";
import { ChevronLeft, ChevronRight, CheckCircle2, GraduationCap } from "lucide-react";
import type { ChapterNavigationProps } from "@/types/component-props";

export function ChapterNavigation({
  allBlocksCompleted,
  isLast,
  onNext,
  onPrevious,
  hasPrevious,
  examAvailable,
  onStartExam,
}: ChapterNavigationProps) {
  const showExamButton = isLast && allBlocksCompleted && examAvailable && onStartExam;

  return (
    <div
      className="ey-animate-fade-up flex items-center justify-between border-t border-border/50 pt-6 mt-8"
      style={{ animationDelay: "200ms" }}
    >
      {/* Previous */}
      <Button
        variant="outline"
        onClick={onPrevious}
        disabled={!hasPrevious}
        className="gap-2"
      >
        <ChevronLeft className="h-4 w-4" aria-hidden="true" />
        Previous
      </Button>

      {/* Center status */}
      <div className="flex items-center gap-3">
        {allBlocksCompleted ? (
          <span className="flex items-center gap-1.5 text-sm font-semibold text-[hsl(var(--ey-green-500))]">
            <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
            All blocks completed
          </span>
        ) : (
          <span className="text-xs text-muted-foreground">
            Complete all blocks to finish this chapter
          </span>
        )}
      </div>

      {/* Next / Take Exam */}
      {showExamButton ? (
        <Button
          onClick={onStartExam}
          className="gap-2 ey-bg-accent text-foreground hover:opacity-90"
        >
          <GraduationCap className="h-4 w-4" aria-hidden="true" />
          Take Exam
        </Button>
      ) : (
        <Button
          onClick={onNext}
          disabled={isLast}
          className="gap-2 ey-bg-dark hover:ey-bg-dark-deep text-white"
        >
          {isLast ? "Last Chapter" : "Next"}
          <ChevronRight className="h-4 w-4" aria-hidden="true" />
        </Button>
      )}
    </div>
  );
}
