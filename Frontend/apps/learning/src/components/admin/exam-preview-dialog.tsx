"use client";

import { useState, useCallback } from "react";
import { useTranslations } from "next-intl";
import {
  CheckCircle2,
  XCircle,
  Clock,
  Target,
  HelpCircle,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  Button,
  Badge,
  Card,
  CardContent,
  Progress,
} from "@repo/ui";
import type { AdminExamDetail, AdminExamQuestion } from "@/types/admin";

interface ExamPreviewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  exam: AdminExamDetail;
  questions: AdminExamQuestion[];
}

export function ExamPreviewDialog({
  open,
  onOpenChange,
  exam,
  questions,
}: ExamPreviewDialogProps) {
  const t = useTranslations("adminExam");
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedOptions, setSelectedOptions] = useState<
    Record<string, Set<string>>
  >({});
  const [submitted, setSubmitted] = useState(false);

  // Reset state on dialog open
  const handleOpenChange = useCallback(
    (isOpen: boolean) => {
      if (isOpen) {
        setCurrentIndex(0);
        setSelectedOptions({});
        setSubmitted(false);
      }
      onOpenChange(isOpen);
    },
    [onOpenChange]
  );

  if (questions.length === 0) return null;

  const currentQuestion = questions[currentIndex]!;
  const isFirst = currentIndex === 0;
  const isLast = currentIndex === questions.length - 1;
  const totalPoints = questions.reduce((sum, q) => sum + q.points, 0);

  const toggleOption = (
    questionId: string,
    optionId: string,
    questionType: string
  ) => {
    if (submitted) return;
    setSelectedOptions((prev) => {
      const current = new Set(prev[questionId] ?? []);
      if (questionType === "SingleChoice" || questionType === "TrueFalse") {
        // Radio-style
        return { ...prev, [questionId]: new Set([optionId]) };
      }
      // Multi-select toggle
      if (current.has(optionId)) {
        current.delete(optionId);
      } else {
        current.add(optionId);
      }
      return { ...prev, [questionId]: current };
    });
  };

  const answeredCount = Object.keys(selectedOptions).filter(
    (qId) => (selectedOptions[qId]?.size ?? 0) > 0
  ).length;

  // Calculate score on submit
  const getScore = () => {
    let earned = 0;
    for (const q of questions) {
      const selected = selectedOptions[q.id] ?? new Set();
      const correctIds = new Set(
        q.options.filter((o) => o.isCorrect).map((o) => o.id)
      );
      const allCorrect =
        selected.size === correctIds.size &&
        [...selected].every((id) => correctIds.has(id));
      if (allCorrect) earned += q.points;
    }
    return {
      earned,
      total: totalPoints,
      percentage:
        totalPoints > 0 ? Math.round((earned / totalPoints) * 100) : 0,
    };
  };

  const score = submitted ? getScore() : null;
  const passed = score ? score.percentage >= exam.passingScore : false;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <span>{t("preview.title", { title: exam.title })}</span>
            <Badge variant="outline" className="text-xs font-normal">
              {t("preview.learnerView")}
            </Badge>
          </DialogTitle>
        </DialogHeader>

        {/* Exam info bar */}
        <div className="flex flex-wrap items-center gap-3 rounded-lg bg-muted/50 px-4 py-2.5 text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            <HelpCircle className="h-3.5 w-3.5" />
            {t("preview.questionsCount", { count: questions.length })}
          </span>
          <span className="flex items-center gap-1">
            <Target className="h-3.5 w-3.5" />
            {t("preview.pass", { score: exam.passingScore })}
          </span>
          {exam.durationMinutes && (
            <span className="flex items-center gap-1">
              <Clock className="h-3.5 w-3.5" />
              {t("preview.minutes", { minutes: exam.durationMinutes })}
            </span>
          )}
          <span className="ml-auto font-medium text-foreground">
            {t("preview.answered", {
              answered: answeredCount,
              total: questions.length,
            })}
          </span>
        </div>

        {/* Progress bar */}
        <Progress
          value={(answeredCount / questions.length) * 100}
          className="h-1.5"
        />

        {/* Results banner */}
        {submitted && score && (
          <div
            className={`flex items-center gap-3 rounded-lg px-4 py-3 ${
              passed
                ? "bg-green-50 text-green-800 dark:bg-green-950/30 dark:text-green-300"
                : "bg-red-50 text-red-800 dark:bg-red-950/30 dark:text-red-300"
            }`}
          >
            {passed ? (
              <CheckCircle2 className="h-5 w-5 shrink-0" />
            ) : (
              <XCircle className="h-5 w-5 shrink-0" />
            )}
            <div>
              <p className="text-sm font-semibold">
                {passed ? t("preview.passed") : t("preview.notPassed")}
              </p>
              <p className="text-xs">
                {t("preview.scoreSummary", {
                  percentage: score.percentage,
                  earned: score.earned,
                  total: score.total,
                  required: exam.passingScore,
                })}
              </p>
            </div>
          </div>
        )}

        {/* Question card */}
        {!submitted ? (
          <Card className="border-border/60">
            <CardContent className="p-5 space-y-4">
              <div className="flex items-center justify-between">
                <Badge variant="outline" className="text-[10px]">
                  {t("preview.questionProgress", {
                    current: currentIndex + 1,
                    total: questions.length,
                  })}
                </Badge>
                <Badge variant="outline" className="text-[10px]">
                  {t("preview.points", { count: currentQuestion.points })}
                </Badge>
              </div>

              <p className="text-sm font-medium leading-relaxed text-foreground">
                {currentQuestion.questionText}
              </p>

              <p className="text-[11px] text-muted-foreground">
                {currentQuestion.type === "SingleChoice" ||
                currentQuestion.type === "TrueFalse"
                  ? t("preview.selectOne")
                  : t("preview.selectAll")}
              </p>

              <div className="space-y-2">
                {currentQuestion.options.map((opt) => {
                  const isSelected =
                    selectedOptions[currentQuestion.id]?.has(opt.id) ?? false;
                  return (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() =>
                        toggleOption(
                          currentQuestion.id,
                          opt.id,
                          currentQuestion.type
                        )
                      }
                      className={`flex w-full items-center gap-3 rounded-lg border px-4 py-3 text-left text-sm transition-colors ${
                        isSelected
                          ? "border-primary bg-primary/5 text-foreground"
                          : "border-border/60 bg-background text-foreground hover:border-border hover:bg-muted/30"
                      }`}
                    >
                      <span
                        className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 transition-colors ${
                          isSelected
                            ? "border-primary bg-primary text-primary-foreground"
                            : "border-muted-foreground/40"
                        }`}
                      >
                        {isSelected && (
                          <svg
                            className="h-3 w-3"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                            strokeWidth={3}
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              d="M5 13l4 4L19 7"
                            />
                          </svg>
                        )}
                      </span>
                      {opt.optionText}
                    </button>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        ) : (
          /* After submit: show all questions with correct/wrong */
          <div className="space-y-3 max-h-[50vh] overflow-y-auto">
            {questions.map((q, qi) => {
              const selected = selectedOptions[q.id] ?? new Set();
              const correctIds = new Set(
                q.options.filter((o) => o.isCorrect).map((o) => o.id)
              );
              const isCorrect =
                selected.size === correctIds.size &&
                [...selected].every((id) => correctIds.has(id));

              return (
                <Card key={q.id} className="border-border/60">
                  <CardContent className="p-4 space-y-2">
                    <div className="flex items-start gap-2">
                      {isCorrect ? (
                        <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-green-500" />
                      ) : (
                        <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-500" />
                      )}
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium">
                          <span className="text-muted-foreground mr-1">
                            {qi + 1}.
                          </span>
                          {q.questionText}
                        </p>
                        <div className="mt-1.5 space-y-1">
                          {q.options.map((opt) => {
                            const wasSelected = selected.has(opt.id);
                            const isCorrectOpt = opt.isCorrect;
                            let bg = "bg-muted/30 text-muted-foreground";
                            if (isCorrectOpt)
                              bg =
                                "bg-green-50 text-green-700 dark:bg-green-950/30 dark:text-green-400";
                            else if (wasSelected && !isCorrectOpt)
                              bg =
                                "bg-red-50 text-red-700 dark:bg-red-950/30 dark:text-red-400";

                            return (
                              <div
                                key={opt.id}
                                className={`flex items-center gap-2 rounded px-2.5 py-1.5 text-xs ${bg}`}
                              >
                                {wasSelected ? (
                                  isCorrectOpt ? (
                                    <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-green-500" />
                                  ) : (
                                    <XCircle className="h-3.5 w-3.5 shrink-0 text-red-500" />
                                  )
                                ) : isCorrectOpt ? (
                                  <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-green-500 opacity-50" />
                                ) : (
                                  <span className="h-3.5 w-3.5 shrink-0" />
                                )}
                                {opt.optionText}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}

        {/* Navigation */}
        {!submitted ? (
          <div className="flex items-center justify-between pt-2">
            <Button
              variant="outline"
              size="sm"
              disabled={isFirst}
              onClick={() => setCurrentIndex((i) => i - 1)}
            >
              <ChevronLeft className="mr-1 h-4 w-4" />
              {t("preview.previous")}
            </Button>

            <div className="flex items-center gap-1">
              {questions.map((_, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => setCurrentIndex(i)}
                  className={`h-2 w-2 rounded-full transition-colors ${
                    i === currentIndex
                      ? "bg-primary"
                      : (selectedOptions[questions[i]!.id]?.size ?? 0) > 0
                        ? "bg-primary/40"
                        : "bg-muted-foreground/20"
                  }`}
                />
              ))}
            </div>

            {isLast ? (
              <Button
                size="sm"
                disabled={answeredCount < questions.length}
                onClick={() => setSubmitted(true)}
                className="ey-bg-dark hover:opacity-90"
              >
                {t("preview.submitExam")}
              </Button>
            ) : (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentIndex((i) => i + 1)}
              >
                {t("preview.next")}
                <ChevronRight className="ml-1 h-4 w-4" />
              </Button>
            )}
          </div>
        ) : (
          <div className="flex justify-end pt-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleOpenChange(false)}
            >
              {t("preview.closePreview")}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
