"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  ArrowRight,
  Clock,
  Flag,
  MonitorPlay,
  RotateCcw,
  Send,
} from "lucide-react";
import { useWizardStore } from "@/store/wizard-store";
import { cn } from "@/lib/utils";
import type { Question } from "@/types";

type AnswerValue = string | string[];

function asText(value: AnswerValue | undefined): string {
  return typeof value === "string" ? value : "";
}

function isAnsweredValue(value: AnswerValue | undefined): boolean {
  if (typeof value === "string") {
    return value.trim().length > 0;
  }
  return Array.isArray(value) && value.length > 0;
}

function formatRemaining(totalSeconds: number): string {
  const safe = Math.max(totalSeconds, 0);
  const mins = Math.floor(safe / 60)
    .toString()
    .padStart(2, "0");
  const secs = (safe % 60).toString().padStart(2, "0");
  return `${mins}:${secs}`;
}

function shuffleQuestions(questions: Question[]): Question[] {
  const copy = [...questions];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    const left = copy[i];
    const right = copy[j];
    if (!left || !right) continue;
    copy[i] = right;
    copy[j] = left;
  }
  return copy;
}

export function CandidatePreviewPage() {
  const router = useRouter();
  const {
    basicInfo,
    selectedQuestions,
    config,
    previewFlaggedQuestionIds,
    togglePreviewFlaggedQuestion,
    setPreviewFlaggedQuestionIds,
  } = useWizardStore();

  const questions = useMemo(
    () => (config.randomizeOrder ? shuffleQuestions(selectedQuestions) : selectedQuestions),
    [config.randomizeOrder, selectedQuestions]
  );

  const totalDuration = questions.reduce((sum, q) => sum + q.durationMinutes, 0);
  const introTime = config.enableTimeLimit ? config.timeLimitMinutes : totalDuration || 60;
  const initialSeconds = introTime * 60;

  const [phase, setPhase] = useState<"intro" | "running" | "submitted">("intro");
  const [currentIndex, setCurrentIndex] = useState(0);
  const [secondsLeft, setSecondsLeft] = useState(initialSeconds);
  const [answers, setAnswers] = useState<Record<string, AnswerValue>>({});

  const flaggedSet = useMemo(() => new Set(previewFlaggedQuestionIds), [previewFlaggedQuestionIds]);

  const currentQuestion = questions[currentIndex] ?? questions[0];
  const answeredCount = questions.filter((q) => isAnsweredValue(answers[q.id])).length;

  useEffect(() => {
    if (phase !== "running" || !config.enableTimeLimit) return;

    const timer = setInterval(() => {
      setSecondsLeft((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          setPhase("submitted");
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [phase, config.enableTimeLimit]);

  useEffect(() => {
    setSecondsLeft(initialSeconds);
  }, [initialSeconds]);

  useEffect(() => {
    const validIds = new Set(questions.map((q) => q.id));
    const cleaned = previewFlaggedQuestionIds.filter((id) => validIds.has(id));
    if (cleaned.length !== previewFlaggedQuestionIds.length) {
      setPreviewFlaggedQuestionIds(cleaned);
    }
  }, [questions, previewFlaggedQuestionIds, setPreviewFlaggedQuestionIds]);

  function startPreview(): void {
    if (questions.length === 0) return;
    setPhase("running");
  }

  function restartPreview(): void {
    setPhase("intro");
    setCurrentIndex(0);
    setAnswers({});
    setPreviewFlaggedQuestionIds([]);
    setSecondsLeft(initialSeconds);
  }

  function goToQuestion(index: number): void {
    if (index < 0 || index >= questions.length) return;
   if (!config.allowSkipping && index > currentIndex) {
      if (!currentQuestion) return;
      if (!isAnsweredValue(answers[currentQuestion.id])) return;
    }
    setCurrentIndex(index);
  }

  function nextQuestion(): void {
    if (currentIndex >= questions.length - 1) return;
    if (!currentQuestion) return;
    if (!config.allowSkipping) {
      if (!isAnsweredValue(answers[currentQuestion.id])) return;
    }
    setCurrentIndex((idx) => idx + 1);
  }

  function prevQuestion(): void {
    if (currentIndex <= 0) return;
    setCurrentIndex((idx) => idx - 1);
  }

  function submitPreview(): void {
    setPhase("submitted");
  }

  if (questions.length === 0) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-50 px-6 py-10">
        <div className="w-full max-w-xl rounded-2xl border border-zinc-200 bg-white p-8 text-center shadow-sm">
          <h1 className="text-[22px] font-bold text-zinc-900">No questions to preview</h1>
          <p className="mt-2 text-[14px] text-zinc-500">
            Add at least one question in the builder before opening candidate preview.
          </p>
          <button
            onClick={() => router.push("/tests/create")}
            className="mt-6 inline-flex items-center gap-2 rounded-xl bg-zinc-900 px-5 py-2.5 text-[14px] font-semibold text-white hover:bg-zinc-800"
          >
            <ArrowLeft className="h-4 w-4" /> Back to Builder
          </button>
        </div>
      </div>
    );
  }

  if (!currentQuestion) {
    return null;
  }

  function updateAnswer(questionId: string, next: AnswerValue): void {
    setAnswers((prev) => ({
      ...prev,
      [questionId]: next,
    }));
  }

  function renderAnswerInput(question: Question): React.ReactNode {
    if (question.type === "True/False") {
      const value = asText(answers[question.id]);
      return (
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {["True", "False"].map((choice) => {
            const selected = value === choice;
            return (
              <button
                key={choice}
                type="button"
                onClick={() => updateAnswer(question.id, choice)}
                className={cn(
                  "rounded-xl border px-4 py-3 text-left text-[14px] font-medium transition-colors",
                  selected
                    ? "border-zinc-900 bg-zinc-900 text-white"
                    : "border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50"
                )}
              >
                {choice}
              </button>
            );
          })}
        </div>
      );
    }

    if (question.type === "Multiple Choice") {
      const value = asText(answers[question.id]);
      const options = ["Option A", "Option B", "Option C", "Option D"];
      return (
        <div>
          <p className="mb-2 text-[12px] text-zinc-500">Preview options (placeholder)</p>
          <div className="space-y-2">
            {options.map((choice) => {
              const selected = value === choice;
              return (
                <button
                  key={choice}
                  type="button"
                  onClick={() => updateAnswer(question.id, choice)}
                  className={cn(
                    "flex w-full items-center gap-3 rounded-xl border px-4 py-3 text-left text-[14px] transition-colors",
                    selected
                      ? "border-zinc-900 bg-zinc-900 text-white"
                      : "border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50"
                  )}
                >
                  <span
                    className={cn(
                      "inline-flex h-4 w-4 rounded-full border",
                      selected ? "border-white bg-white" : "border-zinc-300"
                    )}
                  />
                  {choice}
                </button>
              );
            })}
          </div>
        </div>
      );
    }

    if (question.type === "Coding" || question.type === "SQL") {
      const value = asText(answers[question.id]);
      const codePlaceholder =
        question.type === "SQL"
          ? "-- Write your SQL query here\nSELECT *\nFROM table_name;"
          : "// Write your code solution here\nfunction solve() {\n  return null;\n}";

      return (
        <div className="overflow-hidden rounded-xl border border-zinc-200 bg-white">
          <div className="flex items-center justify-between border-b border-zinc-200 bg-zinc-50 px-3 py-2 text-[12px] text-zinc-500">
            <span>{question.type} Editor</span>
            <span>Autosave disabled in preview</span>
          </div>
          <textarea
            value={value}
            onChange={(e) => updateAnswer(question.id, e.target.value)}
            placeholder={codePlaceholder}
            className="min-h-[240px] w-full resize-y border-0 bg-white px-4 py-3 font-mono text-[13px] text-zinc-900 focus:outline-none"
          />
        </div>
      );
    }

    const value = asText(answers[question.id]);
    return (
      <textarea
        value={value}
        onChange={(e) => updateAnswer(question.id, e.target.value)}
        placeholder="Type your answer here..."
        className="min-h-[220px] w-full rounded-xl border border-zinc-200 bg-white px-4 py-3 text-[14px] text-zinc-900 focus:outline-none focus:ring-2 focus:ring-zinc-900/15"
      />
    );
  }

  return (
    <div className="min-h-screen bg-zinc-50">
      <header className="sticky top-0 z-10 border-b border-zinc-200 bg-white/95 backdrop-blur-sm">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-4">
          <button
            onClick={() => router.push("/tests/create")}
            className="inline-flex items-center gap-2 rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-[13px] font-medium text-zinc-700 hover:bg-zinc-50"
          >
            <ArrowLeft className="h-4 w-4" /> Back to Builder
          </button>

          <div className="inline-flex items-center gap-2 rounded-full border border-zinc-200 bg-zinc-50 px-3 py-1 text-[12px] font-semibold text-zinc-700">
            <MonitorPlay className="h-3.5 w-3.5" /> Candidate Preview Mode
          </div>

          <div className="text-[12px] text-zinc-500">No answers are saved</div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl px-6 py-8">
        {phase === "intro" ? (
          <section className="rounded-2xl border border-zinc-200 bg-white p-8 shadow-sm">
            <h1 className="text-[24px] font-bold text-zinc-900">{basicInfo.title || "Untitled Test"}</h1>
            <p className="mt-2 text-[14px] leading-relaxed text-zinc-600">
              {basicInfo.description || "This is a candidate-facing preview of your test experience."}
            </p>

            <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
              <div className="rounded-xl bg-zinc-50 p-3">
                <p className="text-[11px] uppercase tracking-wide text-zinc-400">Questions</p>
                <p className="mt-1 text-[16px] font-semibold text-zinc-900">{questions.length}</p>
              </div>
              <div className="rounded-xl bg-zinc-50 p-3">
                <p className="text-[11px] uppercase tracking-wide text-zinc-400">Total Time</p>
                <p className="mt-1 text-[16px] font-semibold text-zinc-900">{introTime} min</p>
              </div>
              <div className="rounded-xl bg-zinc-50 p-3">
                <p className="text-[11px] uppercase tracking-wide text-zinc-400">Max Attempts</p>
                <p className="mt-1 text-[16px] font-semibold text-zinc-900">
                  {config.maxAttempts === 0 ? "Unlimited" : config.maxAttempts}
                </p>
              </div>
              <div className="rounded-xl bg-zinc-50 p-3">
                <p className="text-[11px] uppercase tracking-wide text-zinc-400">Passing Score</p>
                <p className="mt-1 text-[16px] font-semibold text-zinc-900">{config.passingThreshold}%</p>
              </div>
            </div>

            <div className="mt-6 rounded-xl border border-zinc-200 bg-zinc-50 p-4 text-[13px] text-zinc-600">
              <p>Question skipping: {config.allowSkipping ? "Allowed" : "Sequential only"}</p>
              <p>Progress bar: {config.showProgressBar ? "Visible" : "Hidden"}</p>
              <p>Question order: {config.randomizeOrder ? "Randomized" : "Fixed"}</p>
            </div>

            <div className="mt-6 flex items-center justify-end gap-3">
              <button
                onClick={() => router.push("/tests/create")}
                className="rounded-xl border border-zinc-200 bg-white px-5 py-2.5 text-[14px] font-semibold text-zinc-700 hover:bg-zinc-50"
              >
                Cancel
              </button>
              <button
                onClick={startPreview}
                className="inline-flex items-center gap-2 rounded-xl bg-zinc-900 px-6 py-2.5 text-[14px] font-semibold text-white hover:bg-zinc-800"
              >
                Start Preview <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          </section>
        ) : null}

        {phase === "running" ? (
          <section className="grid grid-cols-1 gap-5 lg:grid-cols-[260px,1fr]">
            <aside className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
              <p className="text-[12px] font-semibold text-zinc-500">Question Navigator</p>

              {config.showProgressBar ? (
                <div className="mt-3">
                  <div className="h-2 overflow-hidden rounded-full bg-zinc-100">
                    <div
                      className="h-full rounded-full bg-zinc-900 transition-all duration-300"
                      style={{ width: `${((currentIndex + 1) / questions.length) * 100}%` }}
                    />
                  </div>
                  <p className="mt-1 text-[11px] text-zinc-500">
                    {currentIndex + 1} of {questions.length}
                  </p>
                </div>
              ) : null}

              <div className="mt-4 grid grid-cols-5 gap-2 lg:grid-cols-4">
                {questions.map((q, idx) => {
                  const isActive = idx === currentIndex;
                  const isAnswered = isAnsweredValue(answers[q.id]);
                  const canJump = config.allowSkipping || idx <= currentIndex + 1;

                  return (
                    <button
                      key={q.id}
                      onClick={() => goToQuestion(idx)}
                      disabled={!canJump}
                      className={cn(
                        "flex h-9 items-center justify-center rounded-lg border text-[12px] font-semibold transition-colors",
                        isActive
                          ? "border-zinc-900 bg-zinc-900 text-white"
                          : isAnswered
                            ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                            : "border-zinc-200 bg-white text-zinc-600",
                        !canJump ? "cursor-not-allowed opacity-40" : "hover:bg-zinc-50"
                      )}
                      title={`Question ${idx + 1}`}
                    >
                      {idx + 1}
                    </button>
                  );
                })}
              </div>

              {config.enableTimeLimit ? (
                <div className="mt-4 rounded-xl border border-zinc-200 bg-zinc-50 p-3">
                  <p className="text-[11px] uppercase tracking-wide text-zinc-400">Time Remaining</p>
                  <p className="mt-1 flex items-center gap-1.5 text-[18px] font-bold text-zinc-900">
                    <Clock className="h-4 w-4" /> {formatRemaining(secondsLeft)}
                  </p>
                </div>
              ) : null}
            </aside>

            <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-[12px] font-medium text-zinc-500">Question {currentIndex + 1}</p>
                  <h2 className="mt-1 text-[20px] font-semibold text-zinc-900">{currentQuestion.title}</h2>
                </div>

                <button
                  onClick={() => togglePreviewFlaggedQuestion(currentQuestion.id)}
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-[12px] font-medium",
                    flaggedSet.has(currentQuestion.id)
                      ? "border-amber-200 bg-amber-50 text-amber-700"
                      : "border-zinc-200 bg-white text-zinc-600 hover:bg-zinc-50"
                  )}
                >
                  <Flag className="h-3.5 w-3.5" />
                  {flaggedSet.has(currentQuestion.id) ? "Flagged" : "Flag"}
                </button>
              </div>

              <p className="mt-3 text-[14px] leading-relaxed text-zinc-600">{currentQuestion.description}</p>

              <div className="mt-4 grid grid-cols-2 gap-3 text-[12px] text-zinc-500">
                <div className="rounded-lg bg-zinc-50 px-3 py-2">Type: {currentQuestion.type}</div>
                <div className="rounded-lg bg-zinc-50 px-3 py-2">Difficulty: {currentQuestion.difficulty}</div>
              </div>

              <div className="mt-5">
                <label className="mb-2 block text-[12px] font-semibold uppercase tracking-wide text-zinc-400">
                  Candidate Answer
                </label>
                {renderAnswerInput(currentQuestion)}
                {!config.allowSkipping && !isAnsweredValue(answers[currentQuestion.id]) ? (
                  <p className="mt-2 text-[12px] text-amber-600">
                    Add an answer to continue to the next question in sequential mode.
                  </p>
                ) : null}
              </div>

              <div className="mt-6 flex items-center justify-between border-t border-zinc-100 pt-5">
                <button
                  onClick={prevQuestion}
                  disabled={currentIndex === 0}
                  className="inline-flex items-center gap-2 rounded-xl border border-zinc-200 bg-white px-4 py-2 text-[13px] font-semibold text-zinc-700 hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <ArrowLeft className="h-4 w-4" /> Previous
                </button>

                {currentIndex < questions.length - 1 ? (
                  <button
                    onClick={nextQuestion}
                    className="inline-flex items-center gap-2 rounded-xl bg-zinc-900 px-5 py-2 text-[13px] font-semibold text-white hover:bg-zinc-800"
                  >
                    Next <ArrowRight className="h-4 w-4" />
                  </button>
                ) : (
                  <button
                    onClick={submitPreview}
                    className="inline-flex items-center gap-2 rounded-xl bg-zinc-900 px-5 py-2 text-[13px] font-semibold text-white hover:bg-zinc-800"
                  >
                    Submit Preview <Send className="h-4 w-4" />
                  </button>
                )}
              </div>
            </div>
          </section>
        ) : null}

        {phase === "submitted" ? (
          <section className="mx-auto w-full max-w-2xl rounded-2xl border border-zinc-200 bg-white p-8 text-center shadow-sm">
            <h2 className="text-[24px] font-bold text-zinc-900">Preview submission complete</h2>
            <p className="mt-2 text-[14px] leading-relaxed text-zinc-600">
              This was a simulation only. No attempt was recorded and no answers were saved.
            </p>

            <div className="mt-6 rounded-xl border border-zinc-200 bg-zinc-50 p-4 text-left">
              <p className="text-[13px] text-zinc-700">Answered {answeredCount} of {questions.length} questions</p>
              <p className="mt-1 text-[13px] text-zinc-700">
                Flagged {previewFlaggedQuestionIds.length} question(s)
              </p>
            </div>

            <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
              <button
                onClick={restartPreview}
                className="inline-flex items-center gap-2 rounded-xl border border-zinc-200 bg-white px-5 py-2.5 text-[14px] font-semibold text-zinc-700 hover:bg-zinc-50"
              >
                <RotateCcw className="h-4 w-4" /> Restart Preview
              </button>
              <button
                onClick={() => router.push("/tests/create")}
                className="inline-flex items-center gap-2 rounded-xl bg-zinc-900 px-5 py-2.5 text-[14px] font-semibold text-white hover:bg-zinc-800"
              >
                <ArrowLeft className="h-4 w-4" /> Return to Builder
              </button>
            </div>
          </section>
        ) : null}
      </main>
    </div>
  );
}
