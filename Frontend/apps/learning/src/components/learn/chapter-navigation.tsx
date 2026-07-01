"use client";

import { Button } from "@repo/ui";
import { ChevronLeft, ChevronRight, CheckCircle2, GraduationCap } from "lucide-react";
import { useTranslations } from "next-intl";
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
  const t = useTranslations("learn");
  const tCommon = useTranslations("common");
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
        {tCommon("actions.previous")}
      </Button>

      {/* Center status */}
      <div className="flex items-center gap-3">
        {allBlocksCompleted ? (
          <span className="flex items-center gap-1.5 text-sm font-semibold text-[hsl(var(--ey-green-500))]">
            <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
            {t("navigation.allBlocksCompleted")}
          </span>
        ) : (
          <span className="text-xs text-muted-foreground">
            {t("navigation.completeAllHint")}
          </span>
        )}
      </div>

      {/* Next / Take Exam */}
      {showExamButton ? (
        <Button
          onClick={onStartExam}
          className="gap-2 bg-primary text-primary-foreground hover:bg-primary/90"
        >
          <GraduationCap className="h-4 w-4" aria-hidden="true" />
          {t("navigation.takeExam")}
        </Button>
      ) : (
        <Button
          onClick={onNext}
          disabled={isLast}
          className="gap-2 ey-bg-dark hover:ey-bg-dark-deep text-white"
        >
          {isLast ? t("navigation.lastChapter") : tCommon("actions.next")}
          <ChevronRight className="h-4 w-4" aria-hidden="true" />
        </Button>
      )}
    </div>
  );
}
