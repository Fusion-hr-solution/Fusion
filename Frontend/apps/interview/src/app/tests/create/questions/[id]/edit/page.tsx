"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { CreateQuestionSheet } from "@/components/create-test-page/create-question-sheet";
import { getQuestions, updateQuestion } from "@/services/test-service";
import { useWizardStore } from "@/store/wizard-store";
import type { NewQuestionForm, Question } from "@/types";

function toForm(question: Question): NewQuestionForm {
  const defaultOptions = [{ text: "", correct: false }, { text: "", correct: false }];
  const options =
    question.type === "Multiple Choice" || question.type === "True/False"
      ? (question.options && question.options.length > 0 ? question.options : defaultOptions)
      : defaultOptions;

  return {
    type: question.type,
    title: question.title,
    description: question.description,
    difficulty: question.difficulty,
    points: question.points,
    durationMinutes: question.durationMinutes,
    gradingMethod: question.gradingMethod,
    tags: question.tags,
    options,
    language: question.language || (question.type === "SQL" ? "SQL" : "Python"),
    starterCode: question.starterCode ?? "",
    evaluationCriteria: question.evaluationCriteria ?? "",
  };
}

export default function EditQuestionPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const searchParams = useSearchParams();
  const from = useMemo(() => searchParams.get("from") || "/tests/create", [searchParams]);

  const { selectedQuestions, isQuestionSelected, addQuestion, updateSelectedQuestion } = useWizardStore();

  const [question, setQuestion] = useState<Question | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    async function loadQuestion() {
      setIsLoading(true);
      setLoadError(null);

      const selectedMatch = selectedQuestions.find((item) => item.id === params.id);
      if (selectedMatch) {
        if (isMounted) {
          setQuestion(selectedMatch);
          setIsLoading(false);
        }
        return;
      }

      try {
        const allQuestions = await getQuestions();
        const found = allQuestions.find((item) => item.id === params.id) ?? null;
        if (isMounted) {
          setQuestion(found);
          if (!found) {
            setLoadError("Question not found.");
          }
        }
      } catch (error) {
        if (isMounted) {
          setLoadError(error instanceof Error ? error.message : "Failed to load question.");
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    void loadQuestion();

    return () => {
      isMounted = false;
    };
  }, [params.id, selectedQuestions]);

  async function saveEditedQuestion(form: NewQuestionForm, keepInSelection: boolean): Promise<void> {
    if (!question) return;

    const updated = await updateQuestion(question.id, form);

    if (isQuestionSelected(updated.id)) {
      updateSelectedQuestion(updated);
    } else if (keepInSelection) {
      addQuestion(updated);
    }

    router.push(from);
  }

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-zinc-50/40">
        <div className="rounded-2xl border border-zinc-200 bg-white px-5 py-3 text-[13px] text-zinc-600 shadow-sm">
          Loading question...
        </div>
      </div>
    );
  }

  if (loadError || !question) {
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-4 bg-zinc-50/40 px-6 text-center">
        <p className="text-[14px] font-semibold text-zinc-800">{loadError ?? "Question not found."}</p>
        <button
          onClick={() => router.push(from)}
          className="flex items-center gap-2 rounded-xl border border-zinc-200 bg-white px-4 py-2 text-[13px] font-semibold text-zinc-700 shadow-sm hover:bg-zinc-50"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Test Builder
        </button>
      </div>
    );
  }

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-zinc-50/40">
      <div className="flex-1 overflow-y-auto">
        <div className="w-full px-8 py-8">
          <div className="mb-5 flex w-full items-center justify-between">
            <button
              onClick={() => router.push(from)}
              className="flex items-center gap-2 rounded-xl border border-zinc-200 bg-white px-4 py-2 text-[13px] font-semibold text-zinc-700 shadow-sm hover:bg-zinc-50"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to Test Builder
            </button>
          </div>

          <CreateQuestionSheet
            fullPage
            mode="edit"
            initialForm={toForm(question)}
            onClose={() => router.push(from)}
            onSaveToLibrary={(form) => saveEditedQuestion(form, false)}
            onSaveAndAdd={(form) => saveEditedQuestion(form, true)}
          />
        </div>
      </div>
    </div>
  );
}
