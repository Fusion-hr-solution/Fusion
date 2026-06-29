"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Clock,
  Loader2,
  PlayCircle,
  Send,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { CodeRunner } from "@/components/candidate/code-runner";
import {
  startCandidateAttempt,
  submitCandidateAttempt,
  validateCandidateAccess,
  type CandidateAccessQuestion,
  type CandidateAccessSession,
  type CandidateAccessSubmission,
  type CandidateAccessValidation,
} from "@/services/candidate-access-service";

type AnswerDraft = {
  questionId: string;
  answerText?: string;
  selectedOptionIds?: string[];
};

function parseSavedAnswers(raw: string): Record<string, AnswerDraft> {
  if (!raw || raw.trim().length === 0) {
    return {};
  }

  try {
    const parsed = JSON.parse(raw) as unknown;
    const responses = Array.isArray(parsed)
      ? parsed
      : typeof parsed === "object" && parsed !== null && Array.isArray((parsed as { responses?: unknown }).responses)
        ? (parsed as { responses: unknown[] }).responses
        : [];

    const next: Record<string, AnswerDraft> = {};
    for (const item of responses) {
      if (!item || typeof item !== "object") {
        continue;
      }

      const response = item as {
        questionId?: unknown;
        answerText?: unknown;
        selectedOptionIds?: unknown;
      };
      if (typeof response.questionId !== "string" || response.questionId.length === 0) {
        continue;
      }

      next[response.questionId] = {
        questionId: response.questionId,
        answerText: typeof response.answerText === "string" ? response.answerText : undefined,
        selectedOptionIds: Array.isArray(response.selectedOptionIds)
          ? response.selectedOptionIds.filter((value): value is string => typeof value === "string")
          : undefined,
      };
    }

    return next;
  } catch {
    return {};
  }
}

function toAnswersPayload(drafts: Record<string, AnswerDraft>): { responses: AnswerDraft[] } {
  return {
    responses: Object.values(drafts).filter((item) =>
      Boolean((item.answerText && item.answerText.trim().length > 0) || (item.selectedOptionIds && item.selectedOptionIds.length > 0))
    ),
  };
}

function formatUtc(value?: string): string {
  if (!value) {
    return "-";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleString("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function formatRemaining(totalSeconds: number): string {
  const safe = Math.max(totalSeconds, 0);
  const mins = Math.floor(safe / 60)
    .toString()
    .padStart(2, "0");
  const secs = (safe % 60).toString().padStart(2, "0");
  return `${mins}:${secs}`;
}

function normalizeQuestionType(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, "");
}

function formatQuestionType(value: string): string {
  const normalized = normalizeQuestionType(value);
  if (normalized === "multiplechoice") return "Multiple Choice";
  if (normalized === "truefalse") return "True/False";
  if (normalized === "sql") return "SQL";
  if (normalized === "casestudy") return "Case Study";
  return value;
}

function seedFromString(value: string): number {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash * 31 + value.charCodeAt(i)) | 0;
  }
  return Math.abs(hash) || 1;
}

function seededRandom(seed: number): () => number {
  let value = seed >>> 0;
  return () => {
    value = (value * 1664525 + 1013904223) >>> 0;
    return value / 0x100000000;
  };
}

function orderQuestions(
  questions: CandidateAccessQuestion[],
  seedValue: string,
  randomize: boolean
): CandidateAccessQuestion[] {
  if (!randomize || questions.length <= 1) {
    return questions;
  }

  const rng = seededRandom(seedFromString(seedValue));
  const copy = [...questions];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    const left = copy[i];
    const right = copy[j];
    if (!left || !right) continue;
    copy[i] = right;
    copy[j] = left;
  }
  return copy;
}

function isAnsweredDraft(draft?: AnswerDraft): boolean {
  if (!draft) return false;
  if (draft.answerText && draft.answerText.trim().length > 0) return true;
  return Boolean(draft.selectedOptionIds && draft.selectedOptionIds.length > 0);
}

async function buildBrowserFingerprint(): Promise<string> {
  const parts = [
    navigator.userAgent,
    navigator.language,
    Intl.DateTimeFormat().resolvedOptions().timeZone,
    `${window.screen.width}x${window.screen.height}`,
    `${window.devicePixelRatio || 1}`,
  ];
  const raw = parts.join("|");

  if (window.crypto?.subtle) {
    const bytes = new TextEncoder().encode(raw);
    const digest = await window.crypto.subtle.digest("SHA-256", bytes);
    return Array.from(new Uint8Array(digest))
      .map((item) => item.toString(16).padStart(2, "0"))
      .join("")
      .toUpperCase();
  }

  return raw;
}

export default function CandidateStartPage() {
  const searchParams = useSearchParams();
  const token = useMemo(() => searchParams.get("token")?.trim() ?? "", [searchParams]);

  const [validation, setValidation] = useState<CandidateAccessValidation | null>(null);
  const [session, setSession] = useState<CandidateAccessSession | null>(null);
  const [submission, setSubmission] = useState<CandidateAccessSubmission | null>(null);
  const [answers, setAnswers] = useState<Record<string, AnswerDraft>>({});
  const [currentIndex, setCurrentIndex] = useState(0);
  const [lockedBeforeIndex, setLockedBeforeIndex] = useState(-1);
  const [secondsLeft, setSecondsLeft] = useState<number | null>(null);
  const [loadingValidation, setLoadingValidation] = useState(true);
  const [starting, setStarting] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [browserFingerprint, setBrowserFingerprint] = useState<string>("");
  const timeLimitMinutes = session?.timeLimitMinutes ?? validation?.timeLimitMinutes ?? null;
  const allowSkipping = session?.allowSkipping ?? validation?.allowSkipping ?? false;
  const allowBacktracking = session?.allowBacktracking ?? validation?.allowBacktracking ?? true;
  const showProgressBar = session?.showProgressBar ?? validation?.showProgressBar ?? true;
  const randomizeOrder = session?.randomizeOrder ?? validation?.randomizeOrder ?? false;
  const orderedQuestions = useMemo(() => {
    if (!session) return [];
    const seed = session.attemptId || session.invitationId || token || "candidate";
    return orderQuestions(session.questions, seed, randomizeOrder);
  }, [session, randomizeOrder, token]);

  async function resolveBrowserFingerprint(): Promise<string> {
    if (browserFingerprint.trim().length > 0) {
      return browserFingerprint;
    }

    try {
      const fingerprint = await buildBrowserFingerprint();
      setBrowserFingerprint(fingerprint);
      return fingerprint;
    } catch {
      const fallback = navigator.userAgent || "";
      setBrowserFingerprint(fallback);
      return fallback;
    }
  }

  useEffect(() => {
    let active = true;

    async function loadFingerprint(): Promise<void> {
      try {
        const fingerprint = await buildBrowserFingerprint();
        if (!active) {
          return;
        }

        setBrowserFingerprint(fingerprint);
      } catch {
        if (!active) {
          return;
        }

        setBrowserFingerprint(navigator.userAgent || "");
      }
    }

    void loadFingerprint();

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    let active = true;

    async function runValidation(): Promise<void> {
      if (!token) {
        setValidation({
          isValid: false,
          canStart: false,
          canResume: false,
          canSubmit: false,
          requiresEmailVerification: false,
          requiresIpLock: false,
          requiresBrowserFingerprint: false,
          singleUseLinkEnabled: false,
          allowSkipping: false,
          allowBacktracking: false,
          showProgressBar: false,
          randomizeOrder: false,
          status: "Invalid",
          message: "A valid invitation token is required.",
        });
        setLoadingValidation(false);
        return;
      }

      setLoadingValidation(true);
      setError(null);

      try {
        const data = await validateCandidateAccess(token);
        if (!active) {
          return;
        }

        setValidation(data);
      } catch (err) {
        if (!active) {
          return;
        }

        setValidation({
          isValid: false,
          canStart: false,
          canResume: false,
          canSubmit: false,
          requiresEmailVerification: false,
          requiresIpLock: false,
          requiresBrowserFingerprint: false,
          singleUseLinkEnabled: false,
          allowSkipping: false,
          allowBacktracking: false,
          showProgressBar: false,
          randomizeOrder: false,
          status: "Invalid",
          message: err instanceof Error ? err.message : "Invitation validation failed.",
        });
      } finally {
        if (active) {
          setLoadingValidation(false);
        }
      }
    }

    void runValidation();

    return () => {
      active = false;
    };
  }, [token]);

  useEffect(() => {
    if (!session || !timeLimitMinutes) {
      setSecondsLeft(null);
      return;
    }

    const startedAtMs = new Date(session.startedAtUtc).getTime();
    const totalSeconds = timeLimitMinutes * 60;

    const tick = () => {
      const elapsed = Math.max((Date.now() - startedAtMs) / 1000, 0);
      const remaining = Math.max(Math.ceil(totalSeconds - elapsed), 0);
      setSecondsLeft(remaining);
    };

    tick();
    const timer = window.setInterval(tick, 1000);
    return () => window.clearInterval(timer);
  }, [session?.attemptId, timeLimitMinutes]);

  useEffect(() => {
    if (!session || orderedQuestions.length === 0) {
      return;
    }
    if (currentIndex >= orderedQuestions.length) {
      setCurrentIndex(0);
    }
  }, [session, currentIndex, orderedQuestions.length]);

  useEffect(() => {
    if (session) {
      setLockedBeforeIndex(-1);
    }
  }, [session?.attemptId]);

  async function handleStartOrResume(): Promise<void> {
    if (!token) {
      setError("Missing token.");
      return;
    }

    const candidateEmail = validation?.candidateEmail?.trim() ?? "";
    if (validation?.requiresEmailVerification && !candidateEmail) {
      setError("Invitation email is unavailable. Please request a new invitation.");
      return;
    }

    setStarting(true);
    setError(null);

    try {
      const resolvedFingerprint = await resolveBrowserFingerprint();
      const data = await startCandidateAttempt(token, {
        candidateEmail: candidateEmail || undefined,
        browserFingerprint: resolvedFingerprint || undefined,
      });
      const parsedAnswers = parseSavedAnswers(data.answersJson);
      const ordered = orderQuestions(
        data.questions,
        data.attemptId || data.invitationId || token || "candidate",
        data.randomizeOrder
      );
      const firstUnansweredIndex = ordered.findIndex(
        (question) => !isAnsweredDraft(parsedAnswers[question.id])
      );

      setSession(data);
      setAnswers(parsedAnswers);
      setCurrentIndex(firstUnansweredIndex >= 0 ? firstUnansweredIndex : 0);
      setLockedBeforeIndex(-1);
      setValidation((prev) =>
        prev
          ? {
              ...prev,
              status: "InProgress",
              canStart: false,
              canResume: true,
              canSubmit: true,
            }
          : prev
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to open the assessment.");
    } finally {
      setStarting(false);
    }
  }

  async function handleSubmit(): Promise<void> {
    if (!token || !session) {
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const resolvedFingerprint = await resolveBrowserFingerprint();
      const answersPayload = toAnswersPayload(answers);
      const resultPayload = {
        source: "candidate-link",
        answeredQuestions: answersPayload.responses.length,
        totalQuestions: session.questions.length,
      };

      const submitted = await submitCandidateAttempt(token, answersPayload, resultPayload, {
        browserFingerprint: resolvedFingerprint || undefined,
      });
      setSubmission(submitted);
      setValidation((prev) =>
        prev
          ? {
              ...prev,
              status: "Submitted",
              isValid: false,
              canStart: false,
              canResume: false,
              canSubmit: false,
              message: "This invitation link has already been used for a submitted attempt.",
            }
          : prev
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to submit assessment.");
    } finally {
      setSubmitting(false);
    }
  }

  function updateTextAnswer(questionId: string, value: string): void {
    setAnswers((prev) => ({
      ...prev,
      [questionId]: {
        questionId,
        answerText: value,
        selectedOptionIds: prev[questionId]?.selectedOptionIds,
      },
    }));
  }

  function selectSingleOption(questionId: string, optionId: string): void {
    setAnswers((prev) => ({
      ...prev,
      [questionId]: {
        questionId,
        answerText: prev[questionId]?.answerText,
        selectedOptionIds: [optionId],
      },
    }));
  }

  function toggleOption(questionId: string, optionId: string): void {
    setAnswers((prev) => {
      const current = prev[questionId]?.selectedOptionIds ?? [];
      const next = current.includes(optionId)
        ? current.filter((item) => item !== optionId)
        : [...current, optionId];

      return {
        ...prev,
        [questionId]: {
          questionId,
          answerText: prev[questionId]?.answerText,
          selectedOptionIds: next,
        },
      };
    });
  }

  function canAdvanceFromCurrent(): boolean {
    if (orderedQuestions.length === 0) return false;
    const current = orderedQuestions[currentIndex];
    if (!current) return false;
    return isAnsweredDraft(answers[current.id]);
  }

  function goToQuestion(index: number): void {
    if (orderedQuestions.length === 0) return;
    if (index < 0 || index >= orderedQuestions.length) return;
    if (!allowBacktracking && index <= lockedBeforeIndex) return;
    if (!allowSkipping && index > currentIndex) {
      if (!canAdvanceFromCurrent()) return;
    }
    setCurrentIndex(index);
  }

  function nextQuestion(): void {
    if (orderedQuestions.length === 0) return;
    if (!allowSkipping && !canAdvanceFromCurrent()) return;
    if (!allowBacktracking && canAdvanceFromCurrent()) {
      setLockedBeforeIndex((prev) => Math.max(prev, currentIndex));
    }
    setCurrentIndex((prev) => Math.min(prev + 1, orderedQuestions.length - 1));
  }

  function prevQuestion(): void {
    if (!allowBacktracking && currentIndex - 1 <= lockedBeforeIndex) return;
    setCurrentIndex((prev) => Math.max(prev - 1, 0));
  }

  function renderAnswerInput(question: CandidateAccessQuestion): React.ReactNode {
    const draft = answers[question.id];
    const normalizedType = normalizeQuestionType(question.type);
    const isTrueFalse = normalizedType === "truefalse";
    const isMultipleChoice = normalizedType === "multiplechoice";
    const isSql = normalizedType === "sql";
    const isCoding = normalizedType === "coding";

    if ((isTrueFalse || isMultipleChoice) && question.options.length > 0) {
      const isSingleChoice = isTrueFalse;
      const selectedIds = draft?.selectedOptionIds ?? [];
      const helperText = isSingleChoice ? "Select one option" : "Select one or more choices";

      return (
        <div>
          <p className="mb-2 text-[12px] text-zinc-500">{helperText}</p>
          <div className="space-y-2">
            {question.options.map((option) => {
              const selected = selectedIds.includes(option.id);
              return (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => {
                    if (isSingleChoice) {
                      selectSingleOption(question.id, option.id);
                      return;
                    }
                    toggleOption(question.id, option.id);
                  }}
                  className={cn(
                    "flex w-full items-start gap-3 rounded-xl border px-4 py-3 text-left text-[14px] transition-colors",
                    selected
                      ? "border-zinc-900 bg-zinc-900 text-white"
                      : "border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50"
                  )}
                >
                  <span
                    className={cn(
                      "mt-0.5 inline-flex h-4 w-4 items-center justify-center rounded border",
                      selected ? "border-white bg-white text-zinc-900" : "border-zinc-300"
                    )}
                  >
                    {selected ? <span className="h-2 w-2 rounded-sm bg-zinc-900" /> : null}
                  </span>
                  {option.text}
                </button>
              );
            })}
          </div>
        </div>
      );
    }

    if (isSql || isCoding) {
      return (
        <CodeRunner
          key={question.id}
          token={token}
          questionId={question.id}
          language={question.language}
          isSql={isSql}
          value={draft?.answerText ?? ""}
          starterCode={question.starterCode}
          projectFiles={question.projectFiles}
          onChange={(next) => updateTextAnswer(question.id, next)}
        />
      );
    }

    return (
      <textarea
        value={draft?.answerText ?? ""}
        onChange={(event) => updateTextAnswer(question.id, event.target.value)}
        placeholder="Type your answer here..."
        className="min-h-[220px] w-full rounded-xl border border-zinc-200 bg-white px-4 py-3 text-[14px] text-zinc-900 focus:outline-none focus:ring-2 focus:ring-zinc-900/15"
      />
    );
  }

  if (loadingValidation) {
    return (
      <div className="mx-auto w-full max-w-3xl p-6">
        <div className="flex items-center gap-2 rounded-xl border border-zinc-200 bg-white p-4 text-zinc-700 shadow-sm">
          <Loader2 className="h-4 w-4 animate-spin" />
          Validating invitation link...
        </div>
      </div>
    );
  }

  if (submission) {
    return (
      <div className="mx-auto w-full max-w-3xl p-6">
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5 text-emerald-900 shadow-sm">
          <div className="flex items-start gap-2">
            <CheckCircle2 className="mt-0.5 h-5 w-5" />
            <div>
              <h1 className="text-lg font-semibold">Assessment submitted</h1>
              <p className="mt-1 text-sm">Your responses were successfully recorded and linked to your invitation.</p>
              <p className="mt-2 text-sm">Submitted at: {formatUtc(submission.submittedAtUtc)}</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!validation || !validation.isValid) {
    return (
      <div className="mx-auto w-full max-w-3xl p-6">
        <div className="rounded-2xl border border-red-200 bg-red-50 p-5 text-red-800 shadow-sm">
          <div className="flex items-start gap-2">
            <AlertTriangle className="mt-0.5 h-5 w-5" />
            <div>
              <h1 className="text-lg font-semibold">Invitation unavailable</h1>
              <p className="mt-1 text-sm">{validation?.message ?? "This invitation cannot be used."}</p>
            </div>
          </div>
          {validation?.testTitle ? (
            <div className="mt-4 rounded-lg border border-red-200 bg-white/70 p-3 text-sm text-red-900">
              <p>Assessment: {validation.testTitle}</p>
              <p>Status: {validation.status}</p>
              <p>Token expiry: {formatUtc(validation.tokenExpiresAtUtc)}</p>
              <p>Deadline: {formatUtc(validation.deadlineUtc)}</p>
            </div>
          ) : null}
        </div>
      </div>
    );
  }

  const activeQuestion = orderedQuestions[currentIndex];
  const answeredCount = orderedQuestions.filter((question) =>
    isAnsweredDraft(answers[question.id])
  ).length;
  const totalQuestions = orderedQuestions.length;
  const showProgress = showProgressBar && totalQuestions > 0;

  return (
    <div className="min-h-screen bg-zinc-50">
      <header className="sticky top-0 z-10 border-b border-zinc-200/70 bg-[linear-gradient(135deg,rgba(9,9,11,0.97),rgba(24,24,27,0.92),rgba(39,39,42,0.9))] text-white shadow-[0_16px_50px_-28px_rgba(0,0,0,0.65)] backdrop-blur-xl">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(255,255,255,0.14),transparent_34%),radial-gradient(circle_at_top_right,rgba(255,255,255,0.08),transparent_28%)]" />
        <div className="relative mx-auto flex w-full max-w-6xl items-center justify-between gap-4 px-6 py-4">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-white/15 bg-white/10 shadow-[inset_0_1px_0_rgba(255,255,255,0.12)]">
              <span className="h-3 w-3 rounded-full bg-emerald-400 shadow-[0_0_18px_rgba(74,222,128,0.85)]" />
            </div>

            <div className="min-w-0">
              <p className="text-[10px] font-semibold uppercase tracking-[0.34em] text-white/55">
                Secure assessment session
              </p>
              <h1 className="truncate text-[16px] font-semibold text-white sm:text-[18px]">
                {validation.testTitle ? validation.testTitle : "Assessment"}
              </h1>
              <p className="mt-0.5 text-[12px] text-white/65">
                Answers are captured privately for this invitation only.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-end gap-2">
            {session?.timeLimitMinutes || validation?.timeLimitMinutes ? (
              <div className="inline-flex items-center gap-2 rounded-full border border-white/12 bg-white/10 px-3 py-1.5 text-[12px] font-medium text-white/90">
                <Clock className="h-3.5 w-3.5 text-emerald-300" />
                {secondsLeft !== null
                  ? `${formatRemaining(secondsLeft)} remaining`
                  : `${timeLimitMinutes ?? validation?.timeLimitMinutes ?? 0} min limit`}
              </div>
            ) : null}

            {showProgress && totalQuestions > 0 ? (
              <div className="inline-flex items-center gap-2 rounded-full border border-white/12 bg-white/10 px-3 py-1.5 text-[12px] font-medium text-white/90">
                <span className="h-2 w-2 rounded-full bg-sky-300 shadow-[0_0_14px_rgba(125,211,252,0.8)]" />
                Question {currentIndex + 1} of {totalQuestions}
              </div>
            ) : null}

            <div className="rounded-full border border-white/12 bg-white/5 px-3 py-1.5 text-[12px] font-medium text-white/70">
              {validation.candidateName || validation.candidateEmail}
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl px-6 py-8">
        <section className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
          <h1 className="text-[24px] font-bold text-zinc-900">{validation.testTitle}</h1>
          <p className="mt-2 text-[14px] leading-relaxed text-zinc-600">
            {validation.message}
          </p>

          <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="rounded-xl bg-zinc-50 p-3">
              <p className="text-[11px] uppercase tracking-wide text-zinc-400">Candidate</p>
              <p className="mt-1 text-[14px] font-semibold text-zinc-900">
                {validation.candidateName || validation.candidateEmail}
              </p>
            </div>
            <div className="rounded-xl bg-zinc-50 p-3">
              <p className="text-[11px] uppercase tracking-wide text-zinc-400">Token Expiry</p>
              <p className="mt-1 text-[14px] font-semibold text-zinc-900">
                {formatUtc(validation.tokenExpiresAtUtc)}
              </p>
            </div>
            <div className="rounded-xl bg-zinc-50 p-3">
              <p className="text-[11px] uppercase tracking-wide text-zinc-400">Deadline</p>
              <p className="mt-1 text-[14px] font-semibold text-zinc-900">
                {formatUtc(validation.deadlineUtc)}
              </p>
            </div>
            <div className="rounded-xl bg-zinc-50 p-3">
              <p className="text-[11px] uppercase tracking-wide text-zinc-400">Time Limit</p>
              <p className="mt-1 text-[14px] font-semibold text-zinc-900">
                {validation.timeLimitMinutes ? `${validation.timeLimitMinutes} min` : "Not set"}
              </p>
            </div>
          </div>

          {validation.requiresEmailVerification || validation.requiresIpLock || validation.requiresBrowserFingerprint ? (
            <div className="mt-6 rounded-xl border border-zinc-200 bg-zinc-50 p-4 text-[12px] text-zinc-600">
              <p className="font-semibold uppercase tracking-wide text-zinc-500">Access checks enabled</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {validation.requiresEmailVerification ? <span className="rounded-full bg-white px-2 py-0.5">Email verification</span> : null}
                {validation.requiresIpLock ? <span className="rounded-full bg-white px-2 py-0.5">IP lock</span> : null}
                {validation.requiresBrowserFingerprint ? <span className="rounded-full bg-white px-2 py-0.5">Browser fingerprint</span> : null}
                {validation.singleUseLinkEnabled ? <span className="rounded-full bg-white px-2 py-0.5">Single-use link</span> : null}
              </div>
            </div>
          ) : null}

          {error ? <p className="mt-4 text-sm text-red-700">{error}</p> : null}

          {!session ? (
            <div className="mt-6 flex justify-end">
              <button
                type="button"
                onClick={() => void handleStartOrResume()}
                disabled={starting}
                className="inline-flex items-center gap-2 rounded-xl bg-zinc-900 px-6 py-2.5 text-[14px] font-semibold text-white hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {starting ? <Loader2 className="h-4 w-4 animate-spin" /> : <PlayCircle className="h-4 w-4" />}
                {validation.canResume ? "Resume Assessment" : "Start Assessment"}
              </button>
            </div>
          ) : null}
        </section>

        {session ? (
          <section className="mt-6 grid grid-cols-1 gap-5 lg:grid-cols-[260px,1fr]">
            <aside className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
              <p className="text-[12px] font-semibold text-zinc-500">Question Navigator</p>

              {showProgress ? (
                <div className="mt-3">
                  <div className="h-2 overflow-hidden rounded-full bg-zinc-100">
                    <div
                      className="h-full rounded-full bg-zinc-900 transition-all duration-300"
                      style={{ width: `${((currentIndex + 1) / totalQuestions) * 100}%` }}
                    />
                  </div>
                  <p className="mt-1 text-[11px] text-zinc-500">
                    {currentIndex + 1} of {totalQuestions}
                  </p>
                </div>
              ) : null}

              <div className="mt-4 grid grid-cols-5 gap-2 lg:grid-cols-4">
                {orderedQuestions.map((question, idx) => {
                  const isActive = idx === currentIndex;
                  const isAnswered = isAnsweredDraft(answers[question.id]);
                  const canJumpForward = allowSkipping || idx <= currentIndex + 1;
                  const canJumpBack = allowBacktracking || idx > lockedBeforeIndex;
                  const canJump = canJumpForward && canJumpBack;

                  return (
                    <button
                      key={question.id}
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

              {secondsLeft !== null ? (
                <div className="mt-4 rounded-xl border border-zinc-200 bg-zinc-50 p-3">
                  <p className="text-[11px] uppercase tracking-wide text-zinc-400">Time Remaining</p>
                  <p className="mt-1 flex items-center gap-1.5 text-[18px] font-bold text-zinc-900">
                    <Clock className="h-4 w-4" /> {formatRemaining(secondsLeft)}
                  </p>
                </div>
              ) : null}

              <div className="mt-4 rounded-xl border border-zinc-200 bg-zinc-50 p-3 text-[12px] text-zinc-600">
                Answered {answeredCount} of {totalQuestions}
              </div>
            </aside>

            <div className="min-w-0 rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
              {activeQuestion ? (
                <>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-[12px] font-medium text-zinc-500">Question {currentIndex + 1}</p>
                      <h2 className="mt-1 text-[20px] font-semibold text-zinc-900">{activeQuestion.title}</h2>
                    </div>

                    <span className="rounded-full border border-zinc-200 bg-zinc-50 px-2 py-0.5 text-[12px] font-semibold text-zinc-600">
                      {formatQuestionType(activeQuestion.type)}
                    </span>
                  </div>

                  <p className="mt-3 whitespace-pre-wrap break-words text-[14px] leading-relaxed text-zinc-600">
                    {activeQuestion.description}
                  </p>

                  <div className="mt-4 grid grid-cols-2 gap-3 text-[12px] text-zinc-500">
                    <div className="rounded-lg bg-zinc-50 px-3 py-2">Points: {activeQuestion.points}</div>
                    <div className="rounded-lg bg-zinc-50 px-3 py-2">
                      Duration: {activeQuestion.durationMinutes} min
                    </div>
                  </div>

                  <div className="mt-5">
                    <label className="mb-2 block text-[12px] font-semibold uppercase tracking-wide text-zinc-400">
                      Candidate Answer
                    </label>
                    {renderAnswerInput(activeQuestion)}
                    {!allowSkipping && !isAnsweredDraft(answers[activeQuestion.id]) ? (
                      <p className="mt-2 text-[12px] text-amber-600">
                        Add an answer to continue to the next question in sequential mode.
                      </p>
                    ) : null}
                  </div>

                  <div className="mt-6 flex items-center justify-between border-t border-zinc-100 pt-5">
                    <button
                      onClick={prevQuestion}
                      disabled={currentIndex === 0 || (!allowBacktracking && currentIndex - 1 <= lockedBeforeIndex)}
                      className="inline-flex items-center gap-2 rounded-xl border border-zinc-200 bg-white px-4 py-2 text-[13px] font-semibold text-zinc-700 hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      <ArrowLeft className="h-4 w-4" /> Previous
                    </button>

                    {currentIndex < totalQuestions - 1 ? (
                      <button
                        onClick={nextQuestion}
                        className="inline-flex items-center gap-2 rounded-xl bg-zinc-900 px-5 py-2 text-[13px] font-semibold text-white hover:bg-zinc-800"
                      >
                        Next <ArrowRight className="h-4 w-4" />
                      </button>
                    ) : (
                      <button
                        onClick={() => void handleSubmit()}
                        disabled={submitting}
                        className="inline-flex items-center gap-2 rounded-xl bg-zinc-900 px-5 py-2 text-[13px] font-semibold text-white hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                        Submit Assessment
                      </button>
                    )}
                  </div>
                </>
              ) : null}
            </div>
          </section>
        ) : null}
      </main>
    </div>
  );
}
