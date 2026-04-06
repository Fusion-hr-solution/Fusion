"use client";

import { Button } from "@repo/ui";
import { Lock, GraduationCap, ChevronRight } from "lucide-react";
import type { ExamLockedBannerProps } from "@/types/component-props";

export function ExamLockedBanner({
  completedCount,
  totalCount,
  examAvailable,
  onStartExam,
}: ExamLockedBannerProps) {
  if (examAvailable) {
    return (
      <div className="flex items-center justify-between border-b border-[hsl(var(--ey-green-500))]/20 bg-[hsl(var(--ey-green-500))]/5 px-8 py-3">
        <div className="flex items-center gap-3">
          <GraduationCap className="h-5 w-5 text-[hsl(var(--ey-green-500))]" aria-hidden="true" />
          <p className="text-sm font-medium text-foreground">
            All chapters completed! You can now take the final exam.
          </p>
        </div>
        <Button
          onClick={onStartExam}
          size="sm"
          className="gap-1.5 ey-bg-accent text-foreground hover:opacity-90"
        >
          Start Exam
          <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
        </Button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-3 border-b border-border/50 bg-muted/30 px-8 py-3">
      <Lock className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
      <p className="text-sm text-muted-foreground">
        Complete all chapters to unlock the exam —{" "}
        <span className="font-semibold text-foreground">
          {completedCount}/{totalCount}
        </span>{" "}
        chapters done
      </p>
    </div>
  );
}
