"use client";

import { Button } from "@repo/ui";
import { Lock, GraduationCap, ChevronRight } from "lucide-react";
import { useTranslations } from "next-intl";
import type { ExamLockedBannerProps } from "@/types/component-props";

export function ExamLockedBanner({
  completedCount,
  totalCount,
  examAvailable,
  onStartExam,
}: ExamLockedBannerProps) {
  const t = useTranslations("exam.banner");
  if (examAvailable) {
    return (
      <div className="flex items-center justify-between border-b border-[hsl(var(--ey-green-500))]/20 bg-[hsl(var(--ey-green-500))]/5 px-8 py-3">
        <div className="flex items-center gap-3">
          <GraduationCap className="h-5 w-5 text-[hsl(var(--ey-green-500))]" aria-hidden="true" />
          <p className="text-sm font-medium text-foreground">
            {t("ready")}
          </p>
        </div>
        <Button
          onClick={onStartExam}
          size="sm"
          className="gap-1.5 bg-primary text-primary-foreground hover:bg-primary/90"
        >
          {t("startExam")}
          <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
        </Button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-3 border-b border-border/50 bg-muted/30 px-8 py-3">
      <Lock className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
      <p className="text-sm text-muted-foreground">
        {t.rich("locked", {
          completed: completedCount,
          total: totalCount,
          strong: (chunks) => <span className="font-semibold text-foreground">{chunks}</span>,
        })}
      </p>
    </div>
  );
}
