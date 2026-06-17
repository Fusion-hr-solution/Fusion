"use client";

import { useState, useCallback, useMemo } from "react";
import { useTranslations } from "next-intl";
import { useApiQuery, useApiMutation } from "@repo/api/react";
import {
  getAdminExamDetail,
  createExam,
  updateExam,
  deleteExam,
  addExamQuestion,
  updateExamQuestion,
  deleteExamQuestion,
  reorderExamQuestions,
} from "@/services/admin-service";
import type {
  AdminExamQuestion,
  CreateExamInput,
  UpdateExamInput,
  CreateExamQuestionInput,
  UpdateExamQuestionInput,
} from "@/types/admin";

export function useExamBuilder(trainingId: string) {
  const t = useTranslations("adminExam");
  const [editingQuestion, setEditingQuestion] =
    useState<AdminExamQuestion | null>(null);
  const [questionDialogOpen, setQuestionDialogOpen] = useState(false);

  const fetchExam = useCallback(
    () => getAdminExamDetail(trainingId),
    [trainingId]
  );

  const {
    data: exam,
    isLoading,
    refetch,
  } = useApiQuery(fetchExam, { enabled: true });

  const questions = useMemo(
    () =>
      (exam?.questions ?? [])
        .slice()
        .sort((a, b) => a.orderIndex - b.orderIndex),
    [exam]
  );

  // --- Exam CRUD ---

  const { mutateAsync: doCreateExam, isLoading: isCreating } = useApiMutation(
    (input: CreateExamInput) => createExam(trainingId, input),
    { onSuccess: () => refetch() }
  );

  const { mutateAsync: doUpdateExam, isLoading: isUpdating } = useApiMutation(
    (input: UpdateExamInput) => {
      if (!exam) throw new Error("No exam to update");
      return updateExam(trainingId, exam.id, input);
    },
    { onSuccess: () => refetch() }
  );

  const { mutateAsync: doDeleteExam } = useApiMutation(
    () => {
      if (!exam) throw new Error("No exam to delete");
      return deleteExam(trainingId, exam.id);
    },
    { onSuccess: () => refetch() }
  );

  // --- Question CRUD ---

  const { mutateAsync: doAddQuestion } = useApiMutation(
    (input: CreateExamQuestionInput) => {
      if (!exam) throw new Error("No exam");
      return addExamQuestion(trainingId, exam.id, input);
    },
    { onSuccess: () => refetch() }
  );

  const { mutateAsync: doUpdateQuestion } = useApiMutation(
    ({
      questionId,
      input,
    }: {
      questionId: string;
      input: UpdateExamQuestionInput;
    }) => {
      if (!exam) throw new Error("No exam");
      return updateExamQuestion(trainingId, exam.id, questionId, input);
    },
    { onSuccess: () => refetch() }
  );

  const { mutateAsync: doDeleteQuestion } = useApiMutation(
    (questionId: string) => {
      if (!exam) throw new Error("No exam");
      return deleteExamQuestion(trainingId, exam.id, questionId);
    },
    { onSuccess: () => refetch() }
  );

  const { mutateAsync: doReorderQuestions } = useApiMutation(
    (questionIds: string[]) => {
      if (!exam) throw new Error("No exam");
      return reorderExamQuestions(trainingId, exam.id, questionIds);
    },
    { onSuccess: () => refetch() }
  );

  // --- Handlers ---

  const handleCreateExam = useCallback(
    async (input: CreateExamInput) => {
      await doCreateExam(input);
    },
    [doCreateExam]
  );

  const handleUpdateExam = useCallback(
    async (input: UpdateExamInput) => {
      await doUpdateExam(input);
    },
    [doUpdateExam]
  );

  const handleDeleteExam = useCallback(async () => {
    if (!confirm(t("toast.confirmDeleteExam"))) return;
    await doDeleteExam(undefined);
  }, [doDeleteExam, t]);

  const handleAddQuestion = useCallback(
    async (input: CreateExamQuestionInput) => {
      await doAddQuestion(input);
    },
    [doAddQuestion]
  );

  const handleUpdateQuestion = useCallback(
    async (questionId: string, input: UpdateExamQuestionInput) => {
      await doUpdateQuestion({ questionId, input });
    },
    [doUpdateQuestion]
  );

  const handleDeleteQuestion = useCallback(
    async (question: AdminExamQuestion) => {
      const text = `${question.questionText.slice(0, 50)}...`;
      if (!confirm(t("toast.confirmDeleteQuestion", { text }))) return;
      await doDeleteQuestion(question.id);
    },
    [doDeleteQuestion, t]
  );

  const handleReorderQuestions = useCallback(
    async (questionIds: string[]) => {
      await doReorderQuestions(questionIds);
    },
    [doReorderQuestions]
  );

  const openQuestionDialog = useCallback(
    (question: AdminExamQuestion | null) => {
      setEditingQuestion(question);
      setQuestionDialogOpen(true);
    },
    []
  );

  const closeQuestionDialog = useCallback(() => {
    setQuestionDialogOpen(false);
    setEditingQuestion(null);
  }, []);

  return {
    exam,
    questions,
    isLoading,
    isCreating,
    isUpdating,
    refetch,
    editingQuestion,
    questionDialogOpen,
    openQuestionDialog,
    closeQuestionDialog,
    handleCreateExam,
    handleUpdateExam,
    handleDeleteExam,
    handleAddQuestion,
    handleUpdateQuestion,
    handleDeleteQuestion,
    handleReorderQuestions,
  };
}
