"use client";

import { useState, useCallback, useMemo } from "react";
import { useApiQuery, useApiMutation } from "@repo/api/react";
import type { ExamSubmissionResult } from "@/types";
import type { ExamPhase } from "@/types/component-props";
import { getExamForLearner, submitExam, getExamAttempts } from "@/services/learning-service";

export function useExamPlayer(trainingId: string) {
  const [phase, setPhase] = useState<ExamPhase>("idle");
  const [answers, setAnswers] = useState<Record<string, string[]>>({});
  const [result, setResult] = useState<ExamSubmissionResult | null>(null);
  const [enabled, setEnabled] = useState(false);

  const fetchExam = useCallback(
    () => getExamForLearner(trainingId),
    [trainingId],
  );
  const fetchAttempts = useCallback(
    () => getExamAttempts(trainingId),
    [trainingId],
  );

  const { data: exam, isLoading: isLoadingExam, error: examError, refetch: refetchExam } =
    useApiQuery(fetchExam, { enabled });

  const { data: attempts, refetch: refetchAttempts } =
    useApiQuery(fetchAttempts, { enabled });

  const { mutateAsync: doSubmit, isLoading: isSubmitting } = useApiMutation(
    (args: { questionId: string; selectedOptionIds: string[] }[]) =>
      submitExam(trainingId, args),
  );

  const loadExam = useCallback(() => {
    setEnabled(true);
    setPhase("loading");
    setResult(null);
    setAnswers({});
  }, []);

  // Transition to intro once exam data loads
  if (phase === "loading" && exam && !isLoadingExam) {
    setPhase("intro");
  }

  const startExam = useCallback(() => {
    setAnswers({});
    setResult(null);
    setPhase("taking");
  }, []);

  const setAnswer = useCallback((questionId: string, optionIds: string[]) => {
    setAnswers((prev) => ({ ...prev, [questionId]: optionIds }));
  }, []);

  const handleSubmit = useCallback(async () => {
    if (!exam) return;
    setPhase("submitting");
    try {
      const answerList = exam.questions.map((q) => ({
        questionId: q.id,
        selectedOptionIds: answers[q.id] ?? [],
      }));
      const res = await doSubmit(answerList);
      setResult(res);
      setPhase("result");
      refetchAttempts();
    } catch {
      setPhase("taking");
    }
  }, [exam, answers, doSubmit, refetchAttempts]);

  const retryExam = useCallback(() => {
    setAnswers({});
    setResult(null);
    refetchExam();
    setPhase("loading");
  }, [refetchExam]);

  const answeredCount = useMemo(() => {
    return Object.values(answers).filter((v) => v.length > 0).length;
  }, [answers]);

  return {
    exam: exam ?? null,
    attempts: attempts ?? [],
    phase,
    result,
    answers,
    examError,
    isLoadingExam,
    isSubmitting,
    answeredCount,
    loadExam,
    startExam,
    setAnswer,
    handleSubmit,
    retryExam,
  };
}
