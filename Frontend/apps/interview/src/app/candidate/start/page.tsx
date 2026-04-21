"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { AlertTriangle, CheckCircle2, Loader2, PlayCircle, Send } from "lucide-react";
import { cn } from "@/lib/utils";
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
  const [loadingValidation, setLoadingValidation] = useState(true);
  const [starting, setStarting] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [browserFingerprint, setBrowserFingerprint] = useState<string>("");

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
      setSession(data);
      setAnswers(parseSavedAnswers(data.answersJson));
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

  function renderQuestion(question: CandidateAccessQuestion, index: number) {
    const draft = answers[question.id];
    const isSingleChoice = question.type === "MultipleChoice" || question.type === "TrueFalse";

    return (
      <article key={question.id} className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm">
        <div className="mb-3 flex items-start justify-between gap-2">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Question {index + 1}</p>
            <h3 className="text-base font-semibold text-zinc-900">{question.title}</h3>
          </div>
          <span className="rounded-full border border-zinc-200 bg-zinc-50 px-2 py-0.5 text-xs font-semibold text-zinc-600">
            {question.type}
          </span>
        </div>

        {question.description ? (
          <p className="mb-3 whitespace-pre-wrap text-sm text-zinc-700">{question.description}</p>
        ) : null}

        {question.options.length > 0 ? (
          <div className="space-y-2">
            {question.options.map((option) => {
              const checked = Boolean(draft?.selectedOptionIds?.includes(option.id));
              return (
                <label
                  key={option.id}
                  className={cn(
                    "flex cursor-pointer items-start gap-2 rounded-lg border px-3 py-2 text-sm",
                    checked ? "border-zinc-900 bg-zinc-50" : "border-zinc-200 bg-white"
                  )}
                >
                  <input
                    type={isSingleChoice ? "radio" : "checkbox"}
                    name={`question-${question.id}`}
                    checked={checked}
                    onChange={() => {
                      if (isSingleChoice) {
                        selectSingleOption(question.id, option.id);
                        return;
                      }

                      toggleOption(question.id, option.id);
                    }}
                    className="mt-0.5"
                  />
                  <span>{option.text}</span>
                </label>
              );
            })}
          </div>
        ) : (
          <textarea
            value={draft?.answerText ?? ""}
            onChange={(event) => updateTextAnswer(question.id, event.target.value)}
            placeholder="Enter your answer..."
            className="min-h-[120px] w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm text-zinc-900 focus:outline-none focus:ring-2 focus:ring-zinc-900/10"
          />
        )}
      </article>
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

  return (
    <div className="mx-auto w-full max-w-4xl space-y-4 p-6">
      <section className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Secure Candidate Access</p>
        <h1 className="mt-1 text-2xl font-semibold text-zinc-900">{validation.testTitle}</h1>
        <p className="mt-1 text-sm text-zinc-600">
          Candidate: <span className="font-semibold text-zinc-900">{validation.candidateName || validation.candidateEmail}</span>
        </p>
        <div className="mt-3 grid grid-cols-1 gap-2 text-sm text-zinc-700 md:grid-cols-3">
          <p>
            Token expiry: <span className="font-semibold">{formatUtc(validation.tokenExpiresAtUtc)}</span>
          </p>
          <p>
            Deadline: <span className="font-semibold">{formatUtc(validation.deadlineUtc)}</span>
          </p>
          <p>
            Time limit: <span className="font-semibold">{validation.timeLimitMinutes ? `${validation.timeLimitMinutes} min` : "Not set"}</span>
          </p>
        </div>
      </section>

      {!session ? (
        <section className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
          <p className="text-sm text-zinc-700">{validation.message}</p>

          {validation.requiresEmailVerification || validation.requiresIpLock || validation.requiresBrowserFingerprint ? (
            <div className="mt-3 rounded-xl border border-zinc-200 bg-zinc-50 p-3 text-[12px] text-zinc-600">
              <p className="font-semibold uppercase tracking-wide text-zinc-500">Access checks enabled</p>
              <div className="mt-1 flex flex-wrap gap-2">
                {validation.requiresEmailVerification ? <span className="rounded-full bg-white px-2 py-0.5">Email verification</span> : null}
                {validation.requiresIpLock ? <span className="rounded-full bg-white px-2 py-0.5">IP lock</span> : null}
                {validation.requiresBrowserFingerprint ? <span className="rounded-full bg-white px-2 py-0.5">Browser fingerprint</span> : null}
                {validation.singleUseLinkEnabled ? <span className="rounded-full bg-white px-2 py-0.5">Single-use link</span> : null}
              </div>
            </div>
          ) : null}

          {error ? <p className="mt-2 text-sm text-red-700">{error}</p> : null}
          <button
            type="button"
            onClick={() => void handleStartOrResume()}
            disabled={starting}
            className="mt-4 inline-flex items-center gap-2 rounded-xl bg-zinc-900 px-4 py-2 text-sm font-semibold text-white hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {starting ? <Loader2 className="h-4 w-4 animate-spin" /> : <PlayCircle className="h-4 w-4" />}
            {validation.canResume ? "Resume Assessment" : "Start Assessment"}
          </button>
        </section>
      ) : (
        <>
          <section className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4">
            <p className="text-sm text-zinc-700">
              Attempt started: <span className="font-semibold text-zinc-900">{formatUtc(session.startedAtUtc)}</span>
            </p>
            {error ? <p className="mt-2 text-sm text-red-700">{error}</p> : null}
          </section>

          <section className="space-y-3">{session.questions.map(renderQuestion)}</section>

          <div className="flex justify-end">
            <button
              type="button"
              onClick={() => void handleSubmit()}
              disabled={submitting}
              className="inline-flex items-center gap-2 rounded-xl bg-zinc-900 px-5 py-2.5 text-sm font-semibold text-white hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              Submit Assessment
            </button>
          </div>
        </>
      )}
    </div>
  );
}
