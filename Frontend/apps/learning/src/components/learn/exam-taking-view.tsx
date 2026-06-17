"use client";

import { Button, Badge, Progress } from "@repo/ui";
import { GraduationCap, HelpCircle, Target, Clock, Play, Loader2, ArrowLeft } from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";
import type { ExamTakingViewProps } from "@/types/component-props";
import { ExamQuestionItem } from "./exam-question-item";
import { ExamResultView } from "./exam-result-view";

export function ExamTakingView({
  exam,
  attempts,
  phase,
  result,
  answers,
  onSetAnswer,
  onStart,
  onSubmit,
  onRetry,
  onBack,
  isSubmitting,
}: ExamTakingViewProps) {
  const t = useTranslations("exam");
  const tCommon = useTranslations("common");
  if (phase === "result" && result) {
    return <ExamResultView result={result} attempts={attempts} onRetry={onRetry} onBack={onBack} />;
  }

  if (phase === "intro") {
    return <ExamIntro exam={exam} attempts={attempts} onStart={onStart} onBack={onBack} />;
  }

  // Phase: taking or submitting
  const answeredCount = Object.values(answers).filter((v) => v.length > 0).length;
  const total = exam.questions.length;
  const allAnswered = answeredCount === total;

  return (
    <div className="mx-auto max-w-3xl px-8 py-8">
      {/* Header */}
      <div className="ey-animate-fade-up mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-foreground">{exam.title}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {t("taking.answeredCount", { answered: answeredCount, total })}
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={onBack} className="gap-1.5">
          <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
          {tCommon("actions.back")}
        </Button>
      </div>

      <Progress value={(answeredCount / total) * 100} className="mb-8 h-2" />

      {/* Questions */}
      <div className="space-y-5">
        {exam.questions.map((q, i) => (
          <ExamQuestionItem
            key={q.id}
            question={q}
            index={i}
            selectedOptionIds={answers[q.id] ?? []}
            onSetAnswer={onSetAnswer}
          />
        ))}
      </div>

      {/* Submit */}
      <div className="ey-animate-fade-up mt-8 flex items-center justify-between border-t border-border/50 pt-6">
        <p className="text-sm text-muted-foreground">
          {allAnswered
            ? t("taking.allAnswered")
            : t("taking.remaining", { count: total - answeredCount })}
        </p>
        <Button
          onClick={onSubmit}
          disabled={!allAnswered || isSubmitting}
          className="gap-2 ey-bg-dark hover:ey-bg-dark-deep text-white"
        >
          {isSubmitting ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              {t("taking.submitting")}
            </>
          ) : (
            t("taking.submit")
          )}
        </Button>
      </div>
    </div>
  );
}

/* ── Exam intro sub-component ── */

function ExamIntro({
  exam,
  attempts,
  onStart,
  onBack,
}: {
  exam: ExamTakingViewProps["exam"];
  attempts: ExamTakingViewProps["attempts"];
  onStart: () => void;
  onBack: () => void;
}) {
  const t = useTranslations("exam");
  const tCommon = useTranslations("common");
  const format = useFormatter();
  const stats = [
    { icon: HelpCircle, value: `${exam.questionCount}`, label: t("intro.questions") },
    { icon: Target, value: `${exam.passingScore}%`, label: t("passingScore") },
    ...(exam.durationMinutes
      ? [{ icon: Clock, value: t("intro.minutes", { minutes: exam.durationMinutes }), label: t("intro.timeLimit") }]
      : []),
  ];

  const hasPassed = attempts.some((a) => a.passed);

  return (
    <div className="mx-auto max-w-2xl px-8 py-12">
      <div className="ey-animate-fade-up text-center">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-[hsl(var(--ey-yellow))]/15 ring-1 ring-[hsl(var(--ey-yellow))]/20">
          <GraduationCap className="h-7 w-7 text-[hsl(var(--ey-yellow))]" aria-hidden="true" />
        </div>
        <h1 className="text-2xl font-bold text-foreground">{exam.title}</h1>
        {exam.description && (
          <p className="mt-2 text-sm text-muted-foreground max-w-md mx-auto">{exam.description}</p>
        )}
      </div>

      {/* Stats */}
      <div className="ey-animate-fade-up mt-8 grid grid-cols-2 gap-4 sm:grid-cols-3" style={{ animationDelay: "80ms" }}>
        {stats.map((stat) => {
          const Icon = stat.icon;
          return (
            <div key={stat.label} className="rounded-xl border border-border/60 bg-card p-5 text-center">
              <Icon className="mx-auto h-5 w-5 text-muted-foreground mb-2" aria-hidden="true" />
              <p className="text-lg font-bold text-foreground">{stat.value}</p>
              <p className="text-xs text-muted-foreground">{stat.label}</p>
            </div>
          );
        })}
      </div>

      {/* Already passed banner */}
      {hasPassed && (
        <div className="ey-animate-fade-up mt-6 rounded-xl border border-[hsl(var(--ey-green-500))]/30 bg-[hsl(var(--ey-green-500))]/5 px-5 py-3 text-center" style={{ animationDelay: "120ms" }}>
          <p className="text-sm text-[hsl(var(--ey-green-500))] font-medium">
            {t("intro.alreadyPassed")}
          </p>
        </div>
      )}

      {/* Actions */}
      <div className="ey-animate-fade-up mt-8 flex items-center justify-center gap-3" style={{ animationDelay: "160ms" }}>
        <Button onClick={onStart} className="gap-2 ey-bg-dark hover:ey-bg-dark-deep text-white h-11 px-8">
          <Play className="h-4 w-4" aria-hidden="true" />
          {hasPassed ? t("intro.retake") : attempts.length > 0 ? tCommon("actions.retry") : t("intro.begin")}
        </Button>
        <Button variant="outline" onClick={onBack} className="gap-2">
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          {tCommon("actions.back")}
        </Button>
      </div>

      {/* Past attempts */}
      {attempts.length > 0 && (
        <div className="ey-animate-fade-up mt-10" style={{ animationDelay: "200ms" }}>
          <h3 className="mb-3 text-sm font-semibold text-foreground">{t("intro.previousAttempts")}</h3>
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
