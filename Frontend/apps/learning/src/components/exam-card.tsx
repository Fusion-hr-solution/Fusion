"use client";

import {
  GraduationCap,
  HelpCircle,
  Target,
  Clock,
  RotateCcw,
  Lock,
} from "lucide-react";
import { useTranslations } from "next-intl";
import type { ExamCardProps } from "@/types/component-props";

export function ExamCard({ exam, chaptersCount, isEnrolled }: ExamCardProps) {
  const t = useTranslations("trainingDetail.exam");
  const stats = [
    {
      icon: HelpCircle,
      value: t("questionsValue", { count: exam.questionsCount }),
      labelKey: "totalQuestions",
    },
    {
      icon: Target,
      value: `${exam.passingScore}%`,
      labelKey: "passingScore",
    },
    ...(exam.timeLimit
      ? [{ icon: Clock, value: exam.timeLimit, labelKey: "timeLimit" }]
      : []),
    ...(exam.maxAttempts
      ? [{ icon: RotateCcw, value: t("attemptsValue", { count: exam.maxAttempts }), labelKey: "maxAttempts" }]
      : []),
  ];

  return (
    <div className="ey-animate-fade-up rounded-2xl border border-border/60 bg-card overflow-hidden">
      {/* Exam header with accent */}
      <div className="relative flex items-center gap-3 border-b border-border/40 bg-gradient-to-r from-[hsl(var(--ey-yellow))]/8 to-transparent px-6 py-4">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[hsl(var(--ey-yellow))]/15 ring-1 ring-[hsl(var(--ey-yellow))]/20">
          <GraduationCap
            className="h-5 w-5 text-muted-foreground"
            aria-hidden="true"
          />
        </div>
        <div>
          <h3 className="text-sm font-bold text-foreground">
            {t("title")}
          </h3>
          <p className="text-xs text-muted-foreground">
            {t("subtitle")}
          </p>
        </div>
      </div>

      {/* Stats grid */}
      <div className={`grid grid-cols-2 gap-px bg-border/30 ${stats.length <= 2 ? "sm:grid-cols-2 max-w-md" : stats.length === 3 ? "sm:grid-cols-3" : "sm:grid-cols-4"}`}>
        {stats.map((stat) => {
          const Icon = stat.icon;
          return (
            <div
              key={stat.labelKey}
              className="flex flex-col items-center gap-2 bg-card px-4 py-5 text-center"
            >
              <Icon
                className="h-4 w-4 text-muted-foreground"
                aria-hidden="true"
              />
              <span className="text-sm font-bold text-foreground">
                {stat.value}
              </span>
              <span className="text-xs text-muted-foreground">
                {t(stat.labelKey)}
              </span>
            </div>
          );
        })}
      </div>

      {/* Unlock callout — shown only for enrolled users */}
      {isEnrolled && (
        <div className="flex items-center gap-2.5 border-t border-border/40 bg-muted/50 px-6 py-3">
          <Lock
            className="h-3.5 w-3.5 shrink-0 text-muted-foreground"
            aria-hidden="true"
          />
          <p className="text-xs text-muted-foreground">
            {t.rich("unlockHint", {
              count: chaptersCount,
              b: (chunks) => <span className="font-semibold text-foreground">{chunks}</span>,
            })}
          </p>
        </div>
      )}
    </div>
  );
}
