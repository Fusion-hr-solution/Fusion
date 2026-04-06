"use client";

import { Button } from "@repo/ui";
import { ChevronLeft, ChevronRight, CheckCircle2, Loader2 } from "lucide-react";
import type { ChapterNavigationProps } from "@/types/component-props";

export function ChapterNavigation({
  isCompleted,
  isLast,
  onMarkComplete,
  onNext,
  onPrevious,
  hasPrevious,
  isLoading,
}: ChapterNavigationProps) {
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

      {/* Center action */}
      <div className="flex items-center gap-3">
        {!isCompleted && (
          <Button
            onClick={onMarkComplete}
            disabled={isLoading}
            className="gap-2 bg-[hsl(var(--ey-green-500))] hover:bg-[hsl(var(--ey-green-500))]/90 text-white"
          >
            {isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            ) : (
              <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
            )}
            Mark as Complete
          </Button>
        )}
        {isCompleted && (
          <span className="flex items-center gap-1.5 text-sm font-semibold text-[hsl(var(--ey-green-500))]">
            <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
            Completed
          </span>
        )}
      </div>

      {/* Next */}
      <Button
        onClick={onNext}
        disabled={isLast}
        className="gap-2 ey-bg-dark hover:ey-bg-dark-deep text-white"
      >
        {isLast ? "Last Chapter" : "Next"}
        <ChevronRight className="h-4 w-4" aria-hidden="true" />
      </Button>
    </div>
  );
}
