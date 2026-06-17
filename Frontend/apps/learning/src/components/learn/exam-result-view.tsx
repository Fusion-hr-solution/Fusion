"use client";

import { Button, Badge } from "@repo/ui";
import { Trophy, XCircle, RotateCcw, ArrowLeft, Clock } from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";
import type { ExamResultViewProps } from "@/types/component-props";

export function ExamResultView({ result, attempts, onRetry, onBack }: ExamResultViewProps) {
  const t = useTranslations("exam");
  const tCommon = useTranslations("common");
  const format = useFormatter();
  const passed = result.passed;

  return (
    <div className="mx-auto max-w-2xl px-8 py-12">
      {/* Result banner */}
      <div
        className={`ey-animate-scale-in mb-8 rounded-2xl border p-8 text-center ${
          passed
            ? "border-[hsl(var(--ey-green-500))]/30 bg-[hsl(var(--ey-green-500))]/5"
            : "border-destructive/30 bg-destructive/5"
        }`}
      >
        <div
          className={`mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full ${
            passed ? "bg-[hsl(var(--ey-green-500))]/15" : "bg-destructive/15"
          }`}
        >
          {passed ? (
            <Trophy className="h-8 w-8 text-[hsl(var(--ey-green-500))]" aria-hidden="true" />
          ) : (
            <XCircle className="h-8 w-8 text-destructive" aria-hidden="true" />
          )}
        </div>
        <h2 className="text-xl font-bold text-foreground">
          {passed ? t("result.passedTitle") : t("result.failedTitle")}
        </h2>
        <p className="mt-2 text-sm text-muted-foreground">
          {passed ? t("result.passedDescription") : t("result.failedDescription")}
        </p>
        {passed && result.trainingCompleted && (
          <Badge className="mt-3 bg-[hsl(var(--ey-green-500))]/15 text-[hsl(var(--ey-green-500))] border-[hsl(var(--ey-green-500))]/30">
            {t("result.trainingCompleted")}
          </Badge>
        )}
      </div>

      {/* Score details */}
      <div className="ey-animate-fade-up mb-8 grid grid-cols-3 gap-4">
        {[
          { label: t("result.yourScore"), value: `${result.score}%`, highlight: passed },
          { label: t("passingScore"), value: `${result.passingScore}%`, highlight: false },
          { label: t("result.correctAnswers"), value: `${result.correctAnswers}/${result.totalQuestions}`, highlight: false },
        ].map((stat) => (
          <div
            key={stat.label}
            className="rounded-xl border border-border/60 bg-card p-4 text-center"
          >
            <p className={`text-2xl font-bold ${stat.highlight ? (passed ? "text-[hsl(var(--ey-green-500))]" : "text-destructive") : "text-foreground"}`}>
              {stat.value}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">{stat.label}</p>
          </div>
        ))}
      </div>

      {/* Actions */}
      <div className="ey-animate-fade-up flex items-center justify-center gap-3" style={{ animationDelay: "100ms" }}>
        {!passed && (
          <Button onClick={onRetry} className="gap-2 ey-bg-dark hover:ey-bg-dark-deep text-white">
            <RotateCcw className="h-4 w-4" aria-hidden="true" />
            {tCommon("actions.retry")}
          </Button>
        )}
        <Button variant="outline" onClick={onBack} className="gap-2">
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          {passed ? t("result.backToOverview") : t("result.reviewChapters")}
        </Button>
      </div>

      {/* Past attempts */}
      {attempts.length > 0 && (
        <div className="ey-animate-fade-up mt-10" style={{ animationDelay: "150ms" }}>
          <h3 className="mb-3 text-sm font-semibold text-foreground">{t("result.attemptHistory")}</h3>
          <div className="space-y-2">
            {attempts.map((a, i) => (
              <div
                key={a.id}
                className="flex items-center justify-between rounded-lg border border-border/60 bg-card px-4 py-3"
              >
                <div className="flex items-center gap-3">
                  <span className="text-xs font-medium text-muted-foreground">
                    #{attempts.length - i}
                  </span>
                  <Badge variant={a.passed ? "default" : "destructive"} className="text-xs">
                    {a.passed ? t("attempts.passed") : t("attempts.failed")}
                  </Badge>
                  <span className="text-sm font-semibold text-foreground">{a.score}%</span>
                  <span className="text-xs text-muted-foreground">
                    {t("attempts.correctRatio", { correct: a.correctAnswers, total: a.totalQuestions })}
                  </span>
                </div>
                <span className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Clock className="h-3 w-3" aria-hidden="true" />
                  {format.dateTime(new Date(a.attemptedAt), {
                    month: "short",
                    day: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
