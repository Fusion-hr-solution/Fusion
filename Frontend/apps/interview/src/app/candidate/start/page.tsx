"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  CalendarClock,
  Check,
  CheckCircle2,
  Clock,
  Code2,
  Coins,
  Loader2,
  PlayCircle,
  Send,
  ShieldCheck,
  Timer,
  User,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { CodeRunner } from "@/components/candidate/code-runner";
import { FrontendSessionSandbox } from "@/components/candidate/frontend-runner";
import { useBrowserIntegrity } from "@/hooks/use-browser-integrity";
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

/** Per-type accent colors so each question type is instantly recognizable. */
function typeAccent(value: string): { badge: string; dot: string } {
  switch (normalizeQuestionType(value)) {
    case "coding":
      return { badge: "border-violet-200 bg-violet-50 text-violet-700", dot: "bg-violet-500" };
    case "sql":
      return { badge: "border-sky-200 bg-sky-50 text-sky-700", dot: "bg-sky-500" };
    case "frontendproject":
      return { badge: "border-pink-200 bg-pink-50 text-pink-700", dot: "bg-pink-500" };
    case "multiplechoice":
      return { badge: "border-amber-200 bg-amber-50 text-amber-700", dot: "bg-amber-500" };
    case "truefalse":
      return { badge: "border-teal-200 bg-teal-50 text-teal-700", dot: "bg-teal-500" };
    case "essay":
    case "casestudy":
      return { badge: "border-indigo-200 bg-indigo-50 text-indigo-700", dot: "bg-indigo-500" };
    default:
      return { badge: "border-zinc-200 bg-zinc-50 text-zinc-600", dot: "bg-zinc-400" };
  }
}

/** Branded, centered backdrop shared by the standalone candidate screens (loading, error, done). */
function CenteredScreen({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-zinc-50 px-4">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-72 bg-[radial-gradient(circle_at_top,rgba(24,24,27,0.10),transparent_72%)]" />
      <div className="relative w-full max-w-md">{children}</div>
    </div>
  );
}

/** Small labelled info tile with an icon, used on the briefing/landing screen. */
function InfoTile({ icon: Icon, label, value }: { icon: typeof User; label: string; value: string }) {
  return (
    <div className="rounded-xl border border-zinc-100 bg-zinc-50/70 p-3">
      <p className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wide text-zinc-400">
        <Icon className="h-3.5 w-3.5" /> {label}
      </p>
      <p className="mt-1 truncate text-[14px] font-semibold text-zinc-900" title={value}>
        {value}
      </p>
    </div>
  );
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
  // Frontend Project pre-warm: boot the WebContainer during Start (before the attempt/timer) so the
  // question opens instantly. `preparing` shows the progress screen; `prewarmPhase` drives the bar.
  const [preparing, setPreparing] = useState(false);
  const [prewarmPhase, setPrewarmPhase] = useState<string>("idle");
  const [prewarmKey, setPrewarmKey] = useState(0);
  const startedRef = useRef(false);
  const frontendSlotRef = useRef<HTMLDivElement | null>(null);
  const startAttemptRef = useRef<() => Promise<void>>(async () => {});
  const frontendChangeRef = useRef<(value: string) => void>(() => {});
  // Stable handlers for the persistent sandbox (so its message listener subscribes once).
  const handleSandboxPhase = useCallback((phase: string) => setPrewarmPhase(phase), []);
  const handleSandboxReady = useCallback(() => void startAttemptRef.current(), []);
  const handleSandboxChange = useCallback((value: string) => frontendChangeRef.current(value), []);
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

  // Layer B proctoring (browser integrity) — active only during an in-progress, unsubmitted
  // attempt, and only for the layers the author enabled. Camera-free; the server re-gates by flag.
  const proctoring = useBrowserIntegrity({
    token,
    browserFingerprint: browserFingerprint || undefined,
    active: Boolean(session) && !submission,
    activityMonitoring: session?.enableActivityMonitoring ?? false,
    restrictCopyPaste: session?.restrictCopyPaste ?? false,
  });

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
          enableProctoring: false,
          enableActivityMonitoring: false,
          restrictCopyPaste: false,
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
          enableProctoring: false,
          enableActivityMonitoring: false,
          restrictCopyPaste: false,
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

    // If the test has a Frontend Project question, pre-warm its WebContainer BEFORE creating the
    // attempt so the ~1min install runs off the clock. The persistent sandbox (mounted while
    // `preparing`) boots and calls handleSandboxReady → actuallyStart when the dev server is up.
    if (validation?.frontendFramework) {
      setError(null);
      setPrewarmPhase("booting");
      setPreparing(true);
      return;
    }

    await actuallyStart();
  }

  async function actuallyStart(): Promise<void> {
    if (!token || startedRef.current) return;
    startedRef.current = true;
    setStarting(true);
    setError(null);

    try {
      const candidateEmail = validation?.candidateEmail?.trim() ?? "";
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
      startedRef.current = false;
      setError(err instanceof Error ? err.message : "Unable to open the assessment.");
    } finally {
      setStarting(false);
      setPreparing(false);
    }
  }
  startAttemptRef.current = actuallyStart;

  // Frontend Project derived state (at most one such question per test).
  const frontendQuestion = useMemo(
    () => session?.questions.find((q) => normalizeQuestionType(q.type) === "frontendproject") ?? null,
    [session]
  );
  const frontendSavedAnswer = frontendQuestion ? answers[frontendQuestion.id]?.answerText : undefined;
  const frontendRealProject = frontendQuestion
    ? (frontendSavedAnswer && frontendSavedAnswer.trim().length > 0
        ? frontendSavedAnswer
        : frontendQuestion.projectFiles) ?? undefined
    : undefined;
  const activeQuestionForSandbox = orderedQuestions[currentIndex];
  const sandboxVisible =
    Boolean(session) &&
    Boolean(activeQuestionForSandbox) &&
    normalizeQuestionType(activeQuestionForSandbox!.type) === "frontendproject";
  frontendChangeRef.current = (value: string) => {
    if (frontendQuestion) updateTextAnswer(frontendQuestion.id, value);
  };

  function retryPrewarm(): void {
    setPrewarmPhase("booting");
    setPrewarmKey((k) => k + 1);
  }

  async function handleSubmit(): Promise<void> {
    if (!token || !session) {
      return;
    }

    setSubmitting(true);
    setError(null);

    // Deliver the final proctoring batch before the attempt flips to Submitted (after which the
    // ingestion endpoint rejects it). Best-effort via sendBeacon.
    proctoring.flushNow();

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
    const isFrontend = normalizedType === "frontendproject";

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
          browserFingerprint={browserFingerprint || undefined}
          onChange={(next) => updateTextAnswer(question.id, next)}
        />
      );
    }

    if (isFrontend) {
      // The persistent, pre-warmed sandbox iframe (rendered once at page level) overlays this slot
      // when this question is active — so it is never remounted / re-booted on navigation.
      return (
        <div
          ref={frontendSlotRef}
          className="min-h-[600px] w-full overflow-hidden rounded-xl border border-zinc-800 bg-zinc-950"
        />
      );
    }

    return (
      <textarea
        data-proctor-answer
        value={draft?.answerText ?? ""}
        onChange={(event) => updateTextAnswer(question.id, event.target.value)}
        placeholder="Type your answer here..."
        className="min-h-[220px] w-full rounded-xl border border-zinc-200 bg-white px-4 py-3 text-[14px] text-zinc-900 focus:outline-none focus:ring-2 focus:ring-zinc-900/15"
      />
    );
  }

  if (loadingValidation) {
    return (
      <CenteredScreen>
        <div className="rounded-3xl border border-zinc-200 bg-white p-8 text-center shadow-sm">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-zinc-900 text-white">
            <Loader2 className="h-5 w-5 animate-spin" />
          </div>
          <h1 className="mt-4 text-[16px] font-semibold text-zinc-900">Validating your invitation</h1>
          <p className="mt-1 text-[13px] text-zinc-500">Checking the link and preparing your assessment…</p>
        </div>
      </CenteredScreen>
    );
  }

  if (submission) {
    return (
      <CenteredScreen>
        <div className="overflow-hidden rounded-3xl border border-zinc-200 bg-white text-center shadow-sm">
          <div className="relative bg-gradient-to-br from-emerald-600 to-emerald-500 px-8 pb-8 pt-9 text-white">
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.20),transparent_60%)]" />
            <div className="relative mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-white/15 ring-1 ring-white/25">
              <CheckCircle2 className="h-8 w-8" />
            </div>
            <h1 className="relative mt-4 text-[20px] font-bold">Assessment submitted</h1>
            <p className="relative mt-1 truncate text-[13px] text-white/85">
              {submission.testTitle || "Your responses have been recorded."}
            </p>
          </div>
          <div className="px-8 py-6">
            <p className="text-[13px] leading-relaxed text-zinc-600">
              Your answers were securely recorded and linked to your invitation. You can safely close this window.
            </p>
            <div className="mt-4 inline-flex items-center gap-2 rounded-full border border-zinc-200 bg-zinc-50 px-3 py-1.5 text-[12px] font-medium text-zinc-600">
              <Clock className="h-3.5 w-3.5 text-zinc-400" />
              Submitted {formatUtc(submission.submittedAtUtc)}
            </div>
          </div>
        </div>
      </CenteredScreen>
    );
  }

  if (!validation || !validation.isValid) {
    return (
      <CenteredScreen>
        <div className="overflow-hidden rounded-3xl border border-zinc-200 bg-white shadow-sm">
          <div className="flex items-start gap-3 border-b border-zinc-100 bg-red-50 px-6 py-5">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-red-100 text-red-600">
              <AlertTriangle className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <h1 className="text-[16px] font-semibold text-zinc-900">Invitation unavailable</h1>
              <p className="mt-1 text-[13px] text-zinc-600">
                {validation?.message ?? "This invitation cannot be used."}
              </p>
            </div>
          </div>
          {validation?.testTitle ? (
            <dl className="grid grid-cols-1 gap-x-6 gap-y-3 px-6 py-5 text-[13px] sm:grid-cols-2">
              {[
                ["Assessment", validation.testTitle],
                ["Status", validation.status],
                ["Token expiry", formatUtc(validation.tokenExpiresAtUtc)],
                ["Deadline", formatUtc(validation.deadlineUtc)],
              ].map(([label, value]) => (
                <div key={label}>
                  <dt className="text-[11px] uppercase tracking-wide text-zinc-400">{label}</dt>
                  <dd className="mt-0.5 font-medium text-zinc-800">{value}</dd>
                </div>
              ))}
            </dl>
          ) : null}
        </div>
      </CenteredScreen>
    );
  }

  const activeQuestion = orderedQuestions[currentIndex];
  const answeredCount = orderedQuestions.filter((question) =>
    isAnsweredDraft(answers[question.id])
  ).length;
  const totalQuestions = orderedQuestions.length;
  const showProgress = showProgressBar && totalQuestions > 0;
  const answeredPct = totalQuestions > 0 ? Math.round((answeredCount / totalQuestions) * 100) : 0;

  // Timer urgency: amber under 5 min, red (with pulse) under 1 min.
  const timerCritical = secondsLeft !== null && secondsLeft <= 60;
  const timerWarn = secondsLeft !== null && secondsLeft <= 300 && !timerCritical;
  const headerTimerClass = timerCritical
    ? "border-red-400/40 bg-red-500/20 text-red-100"
    : timerWarn
      ? "border-amber-400/40 bg-amber-500/20 text-amber-100"
      : "border-white/12 bg-white/10 text-white/90";

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
              <div
                className={cn(
                  "inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-[12px] font-semibold tabular-nums transition-colors",
                  headerTimerClass,
                  timerCritical && "animate-pulse"
                )}
              >
                <Clock
                  className={cn("h-3.5 w-3.5", timerCritical ? "text-red-200" : timerWarn ? "text-amber-200" : "text-emerald-300")}
                />
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

            {session &&
            (session.enableActivityMonitoring || session.restrictCopyPaste || session.enableProctoring) ? (
              <div
                className="inline-flex items-center gap-1.5 rounded-full border border-amber-300/30 bg-amber-400/10 px-3 py-1.5 text-[12px] font-medium text-amber-100"
                title="This assessment is monitored for integrity (activity and clipboard). Detection runs in your browser."
              >
                <ShieldCheck className="h-3.5 w-3.5" />
                Monitored session
              </div>
            ) : null}

            <div className="rounded-full border border-white/12 bg-white/5 px-3 py-1.5 text-[12px] font-medium text-white/70">
              {validation.candidateName || validation.candidateEmail}
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl px-6 py-8">
        {!session ? (
        <div className="mx-auto max-w-2xl">
          <section className="overflow-hidden rounded-3xl border border-zinc-200 bg-white shadow-[0_24px_70px_-34px_rgba(0,0,0,0.35)]">
            <div className="h-1.5 bg-gradient-to-r from-emerald-500 via-emerald-400 to-teal-400" />
            <div className="px-6 py-8 sm:px-10 sm:py-10">
              <div className="flex flex-col items-center text-center">
                <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-zinc-900 to-zinc-700 text-white shadow-lg ring-1 ring-black/5">
                  <ShieldCheck className="h-8 w-8 text-emerald-300" />
                </div>
                <p className="mt-4 text-[11px] font-semibold uppercase tracking-[0.28em] text-zinc-400">
                  {validation.canResume ? "Welcome back to" : "You're invited to"}
                </p>
                <h1 className="mt-1 text-[26px] font-bold leading-tight text-zinc-900 sm:text-[30px]">
                  {validation.testTitle || "Assessment"}
                </h1>
                {validation.message ? (
                  <p className="mt-2 max-w-md text-[14px] leading-relaxed text-zinc-500">{validation.message}</p>
                ) : null}
              </div>

              <div className="mt-7 grid grid-cols-1 gap-3 sm:grid-cols-3">
                <InfoTile icon={User} label="Candidate" value={validation.candidateName || validation.candidateEmail || "—"} />
                <InfoTile
                  icon={Clock}
                  label="Time limit"
                  value={validation.timeLimitMinutes ? `${validation.timeLimitMinutes} min` : "Not set"}
                />
                <InfoTile icon={CalendarClock} label="Deadline" value={formatUtc(validation.deadlineUtc)} />
              </div>

              {validation.requiresEmailVerification ||
              validation.requiresIpLock ||
              validation.requiresBrowserFingerprint ||
              validation.singleUseLinkEnabled ? (
                <div className="mt-4 flex flex-wrap items-center justify-center gap-2 text-[11px] font-medium">
                  <span className="inline-flex items-center gap-1 text-zinc-400">
                    <ShieldCheck className="h-3.5 w-3.5" /> Secured by
                  </span>
                  {validation.requiresEmailVerification ? (
                    <span className="rounded-full border border-zinc-200 bg-zinc-50 px-2.5 py-1 text-zinc-600">Email verification</span>
                  ) : null}
                  {validation.requiresIpLock ? (
                    <span className="rounded-full border border-zinc-200 bg-zinc-50 px-2.5 py-1 text-zinc-600">IP lock</span>
                  ) : null}
                  {validation.requiresBrowserFingerprint ? (
                    <span className="rounded-full border border-zinc-200 bg-zinc-50 px-2.5 py-1 text-zinc-600">Browser fingerprint</span>
                  ) : null}
                  {validation.singleUseLinkEnabled ? (
                    <span className="rounded-full border border-zinc-200 bg-zinc-50 px-2.5 py-1 text-zinc-600">Single-use link</span>
                  ) : null}
                </div>
              ) : null}

              {error ? (
                <div className="mt-5 flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-[13px] text-red-700">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                  <span>{error}</span>
                </div>
              ) : null}

              {preparing ? (
                <PreparingEnvironment
                  phase={prewarmPhase}
                  onRetry={retryPrewarm}
                  onStartAnyway={() => void actuallyStart()}
                />
              ) : (
                <>
                  <button
                    type="button"
                    onClick={() => void handleStartOrResume()}
                    disabled={starting}
                    className="group mt-7 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-br from-zinc-900 to-zinc-800 px-6 py-3.5 text-[15px] font-semibold text-white shadow-lg transition-all hover:shadow-xl hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {starting ? <Loader2 className="h-4 w-4 animate-spin" /> : <PlayCircle className="h-[18px] w-[18px]" />}
                    {validation.canResume ? "Resume Assessment" : "Start Assessment"}
                    {!starting ? <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" /> : null}
                  </button>
                  <p className="mt-3 flex items-center justify-center gap-1.5 text-[12px] text-zinc-400">
                    <Clock className="h-3.5 w-3.5" />
                    {validation.timeLimitMinutes
                      ? "Your timer starts the moment you begin."
                      : "Take your time — there is no countdown."}
                  </p>
                </>
              )}
            </div>
          </section>
          <p className="mt-4 text-center text-[11px] text-zinc-400">EY HR Platform · Secure assessment session</p>
        </div>
        ) : null}

        {validation?.frontendFramework && (preparing || session) ? (
          <FrontendSessionSandbox
            key={prewarmKey}
            framework={validation.frontendFramework}
            realProject={frontendRealProject}
            visible={sandboxVisible}
            slotRef={frontendSlotRef}
            onPhase={handleSandboxPhase}
            onReady={handleSandboxReady}
            onChange={handleSandboxChange}
          />
        ) : null}

        {session ? (
          <div className="mt-6 space-y-4">
            {error ? (
              <div className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-[13px] text-red-700 shadow-sm">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                <span>{error}</span>
              </div>
            ) : null}
            <section className="grid grid-cols-1 gap-5 lg:grid-cols-[260px,1fr]">
            <aside className="h-max rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm lg:sticky lg:top-24">
              <div className="flex items-center justify-between">
                <p className="text-[12px] font-semibold text-zinc-500">Questions</p>
                <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-[11px] font-semibold text-zinc-600">
                  {answeredCount}/{totalQuestions}
                </span>
              </div>

              {showProgress ? (
                <div className="mt-3">
                  <div className="h-2 overflow-hidden rounded-full bg-zinc-100">
                    <div
                      className="h-full rounded-full bg-emerald-500 transition-all duration-500"
                      style={{ width: `${answeredPct}%` }}
                    />
                  </div>
                  <p className="mt-1 text-[11px] text-zinc-500">{answeredPct}% answered</p>
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
                        "relative flex h-9 items-center justify-center rounded-lg border text-[12px] font-semibold transition-all",
                        isActive
                          ? "border-zinc-900 bg-zinc-900 text-white ring-2 ring-zinc-900/15 ring-offset-1"
                          : isAnswered
                            ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                            : "border-zinc-200 bg-white text-zinc-600",
                        !canJump ? "cursor-not-allowed opacity-40" : "hover:-translate-y-0.5 hover:shadow-sm"
                      )}
                      title={`Question ${idx + 1}${isAnswered ? " · answered" : ""}`}
                    >
                      {idx + 1}
                      {isAnswered && !isActive ? (
                        <span className="absolute -right-1 -top-1 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-emerald-500 text-white shadow-sm">
                          <Check className="h-2.5 w-2.5" strokeWidth={3} />
                        </span>
                      ) : null}
                    </button>
                  );
                })}
              </div>

              <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] text-zinc-400">
                <span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-sm bg-zinc-900" /> Current</span>
                <span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-sm bg-emerald-400" /> Answered</span>
                <span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-sm border border-zinc-300 bg-white" /> To do</span>
              </div>

              {secondsLeft !== null ? (
                <div
                  className={cn(
                    "mt-4 rounded-xl border p-3 transition-colors",
                    timerCritical ? "border-red-200 bg-red-50" : timerWarn ? "border-amber-200 bg-amber-50" : "border-zinc-200 bg-zinc-50"
                  )}
                >
                  <p
                    className={cn(
                      "text-[11px] uppercase tracking-wide",
                      timerCritical ? "text-red-500" : timerWarn ? "text-amber-600" : "text-zinc-400"
                    )}
                  >
                    Time Remaining
                  </p>
                  <p
                    className={cn(
                      "mt-1 flex items-center gap-1.5 text-[20px] font-bold tabular-nums",
                      timerCritical ? "text-red-600" : timerWarn ? "text-amber-700" : "text-zinc-900",
                      timerCritical && "animate-pulse"
                    )}
                  >
                    <Timer className="h-4 w-4" /> {formatRemaining(secondsLeft)}
                  </p>
                </div>
              ) : null}
            </aside>

            <div className="min-w-0 rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
              {activeQuestion ? (
                <>
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 text-[12px] font-medium text-zinc-400">
                        <span className="text-zinc-500">Question {currentIndex + 1}</span>
                        <span className="text-zinc-300">/</span>
                        <span>{totalQuestions}</span>
                        {isAnsweredDraft(answers[activeQuestion.id]) ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-600">
                            <Check className="h-3 w-3" strokeWidth={3} /> Answered
                          </span>
                        ) : null}
                      </div>
                      <h2 className="mt-1.5 text-[21px] font-semibold leading-snug text-zinc-900">{activeQuestion.title}</h2>
                    </div>

                    <span
                      className={cn(
                        "inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-1 text-[12px] font-semibold",
                        typeAccent(activeQuestion.type).badge
                      )}
                    >
                      <span className={cn("h-1.5 w-1.5 rounded-full", typeAccent(activeQuestion.type).dot)} />
                      {formatQuestionType(activeQuestion.type)}
                    </span>
                  </div>

                  <p className="mt-3 whitespace-pre-wrap break-words text-[14px] leading-relaxed text-zinc-600">
                    {activeQuestion.description}
                  </p>

                  <div className="mt-4 flex flex-wrap items-center gap-2 text-[12px]">
                    <span className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-200 bg-zinc-50 px-2.5 py-1 font-medium text-zinc-600">
                      <Coins className="h-3.5 w-3.5 text-amber-500" /> {activeQuestion.points} pts
                    </span>
                    <span className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-200 bg-zinc-50 px-2.5 py-1 font-medium text-zinc-600">
                      <Timer className="h-3.5 w-3.5 text-zinc-400" /> {activeQuestion.durationMinutes} min
                    </span>
                    {activeQuestion.language ? (
                      <span className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-200 bg-zinc-50 px-2.5 py-1 font-medium text-zinc-600">
                        <Code2 className="h-3.5 w-3.5 text-violet-500" /> {activeQuestion.language}
                      </span>
                    ) : null}
                  </div>

                  <div className="mt-5">
                    <label className="mb-2 block text-[11px] font-semibold uppercase tracking-wide text-zinc-400">
                      Your Answer
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
                        className="inline-flex items-center gap-2 rounded-xl bg-zinc-900 px-5 py-2 text-[13px] font-semibold text-white transition-colors hover:bg-zinc-800"
                      >
                        Next <ArrowRight className="h-4 w-4" />
                      </button>
                    ) : (
                      <div className="flex items-center gap-3">
                        {answeredCount < totalQuestions ? (
                          <span className="hidden text-[12px] text-amber-600 sm:inline">
                            {totalQuestions - answeredCount} unanswered
                          </span>
                        ) : null}
                        <button
                          onClick={() => void handleSubmit()}
                          disabled={submitting}
                          className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-5 py-2 text-[13px] font-semibold text-white shadow-sm transition-colors hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                          Submit Assessment
                        </button>
                      </div>
                    )}
                  </div>
                </>
              ) : null}
            </div>
            </section>
          </div>
        ) : null}
      </main>
    </div>
  );
}

const PREWARM_ORDER = ["booting", "installing", "starting", "ready"];
const PREWARM_PCT: Record<string, number> = { idle: 6, booting: 30, installing: 65, starting: 88, ready: 100 };
const PREWARM_STEPS: { key: string; label: string }[] = [
  { key: "booting", label: "Starting runtime" },
  { key: "installing", label: "Installing dependencies" },
  { key: "starting", label: "Starting dev server" },
];

function PreparingEnvironment({
  phase,
  onRetry,
  onStartAnyway,
}: {
  phase: string;
  onRetry: () => void;
  onStartAnyway: () => void;
}) {
  const isError = phase === "error";
  const pct = isError ? 100 : PREWARM_PCT[phase] ?? 6;
  const currentIdx = PREWARM_ORDER.indexOf(phase);

  return (
    <div className="mt-7 rounded-2xl border border-zinc-200 bg-zinc-50/60 p-5">
      <div className="flex items-center gap-2">
        {isError ? (
          <AlertTriangle className="h-[18px] w-[18px] text-amber-500" />
        ) : (
          <Loader2 className="h-[18px] w-[18px] animate-spin text-emerald-500" />
        )}
        <p className="text-[14px] font-semibold text-zinc-800">
          {isError ? "Couldn't prepare the environment" : "Setting up your coding environment"}
        </p>
      </div>
      <p className="mt-1 text-[12px] text-zinc-500">
        {isError
          ? "The runtime failed to start. Retry, or start the test and it will keep trying in the background."
          : "This runs before your test begins — your timer hasn't started yet."}
      </p>

      <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-zinc-200">
        <div
          className={cn("h-full rounded-full transition-all duration-700 ease-out", isError ? "bg-amber-400" : "bg-emerald-500")}
          style={{ width: `${pct}%` }}
        />
      </div>

      <ul className="mt-4 space-y-2.5">
        {PREWARM_STEPS.map((step, i) => {
          const done = !isError && currentIdx > i;
          const active = !isError && currentIdx === i;
          return (
            <li key={step.key} className="flex items-center gap-2.5 text-[13px]">
              <span
                className={cn(
                  "flex h-5 w-5 shrink-0 items-center justify-center rounded-full",
                  done ? "bg-emerald-500 text-white" : active ? "bg-zinc-900 text-white" : "bg-zinc-200 text-zinc-400"
                )}
              >
                {done ? (
                  <Check className="h-3 w-3" strokeWidth={3} />
                ) : active ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <span className="h-1.5 w-1.5 rounded-full bg-current" />
                )}
              </span>
              <span className={cn(done ? "text-zinc-500" : active ? "font-medium text-zinc-800" : "text-zinc-400")}>
                {step.label}
              </span>
            </li>
          );
        })}
      </ul>

      {isError ? (
        <div className="mt-4 flex justify-end gap-2">
          <button
            type="button"
            onClick={onStartAnyway}
            className="rounded-xl border border-zinc-200 bg-white px-4 py-2 text-[13px] font-semibold text-zinc-700 hover:bg-zinc-50"
          >
            Start anyway
          </button>
          <button
            type="button"
            onClick={onRetry}
            className="rounded-xl bg-zinc-900 px-4 py-2 text-[13px] font-semibold text-white hover:bg-zinc-800"
          >
            Retry
          </button>
        </div>
      ) : null}
    </div>
  );
}
