import { createPlatformApiClient } from "@repo/api";

const client = createPlatformApiClient();

export interface CandidateAccessQuestionOption {
  id: string;
  text: string;
}

export interface CandidateAccessQuestion {
  id: string;
  title: string;
  description: string;
  type: string;
  points: number;
  durationMinutes: number;
  language?: string;
  starterCode?: string;
  /** Multi-file coding question starter: JSON { entry, files: [{ path, content }] }. */
  projectFiles?: string;
  /** Frontend Project questions: framework ("react" | "angular" | "next"). */
  framework?: string;
  evaluationCriteria?: string;
  options: CandidateAccessQuestionOption[];
}

export interface CandidateAccessValidation {
  isValid: boolean;
  canStart: boolean;
  canResume: boolean;
  canSubmit: boolean;
  requiresEmailVerification: boolean;
  requiresIpLock: boolean;
  requiresBrowserFingerprint: boolean;
  singleUseLinkEnabled: boolean;
  allowSkipping: boolean;
  allowBacktracking: boolean;
  showProgressBar: boolean;
  randomizeOrder: boolean;
  enableProctoring: boolean;
  enableActivityMonitoring: boolean;
  restrictCopyPaste: boolean;
  /** If the test has a Frontend Project question, its framework ("react" | "angular" | "next"). */
  frontendFramework?: string;
  status: "Invalid" | "Invited" | "InProgress" | "Submitted" | "Expired";
  message: string;
  invitationId?: string;
  testId?: string;
  testTitle?: string;
  candidateEmail?: string;
  candidateName?: string;
  deadlineUtc?: string;
  tokenExpiresAtUtc?: string;
  timeLimitMinutes?: number;
}

export interface StartCandidateAttemptInput {
  candidateEmail?: string;
  browserFingerprint?: string;
}

export interface SubmitCandidateAttemptInput {
  browserFingerprint?: string;
}

export interface ProjectFile {
  path: string;
  content: string;
}

export interface RunCandidateCodeInput {
  questionId: string;
  /** Single-file source. Provide this OR files (multi-file). */
  sourceCode?: string;
  /** Multi-file project. */
  files?: ProjectFile[];
  entryPath?: string;
  language?: string;
  stdin?: string;
  /** Same fingerprint sent on start/submit — re-validated by the run endpoint. */
  browserFingerprint?: string;
}

export interface CandidateRunResult {
  runId: string;
  status: string;
  /** Judge0 status, e.g. "Accepted", "Runtime Error (NZEC)", "Time Limit Exceeded". */
  executionStatus: string;
  stdout?: string;
  stderr?: string;
  compileOutput?: string;
  time?: string;
  memory?: number;
}

export interface CandidateAccessSession {
  invitationId: string;
  attemptId: string;
  testId: string;
  testTitle: string;
  candidateEmail: string;
  candidateName?: string;
  status: string;
  deadlineUtc?: string;
  tokenExpiresAtUtc: string;
  timeLimitMinutes?: number;
  startedAtUtc: string;
  submittedAtUtc?: string;
  answersJson: string;
  resultJson: string;
  allowSkipping: boolean;
  allowBacktracking: boolean;
  showProgressBar: boolean;
  randomizeOrder: boolean;
  enableProctoring: boolean;
  enableActivityMonitoring: boolean;
  restrictCopyPaste: boolean;
  questions: CandidateAccessQuestion[];
}

export interface CandidateAccessSubmission {
  invitationId: string;
  attemptId: string;
  testId: string;
  testTitle: string;
  candidateEmail: string;
  candidateName?: string;
  status: string;
  submittedAtUtc: string;
  answersJson: string;
  resultJson: string;
}

export async function validateCandidateAccess(token: string): Promise<CandidateAccessValidation> {
  return client.get<CandidateAccessValidation>("/interview/candidate-access/validate", {
    params: { token },
    skipAuth: true,
  });
}

export async function startCandidateAttempt(
  token: string,
  input?: StartCandidateAttemptInput
): Promise<CandidateAccessSession> {
  return client.post<CandidateAccessSession>(
    "/interview/candidate-access/start",
    {
      token,
      candidateEmail: input?.candidateEmail,
      browserFingerprint: input?.browserFingerprint,
    },
    { skipAuth: true }
  );
}

export async function submitCandidateAttempt(
  token: string,
  answers: unknown,
  result: unknown,
  input?: SubmitCandidateAttemptInput
): Promise<CandidateAccessSubmission> {
  return client.post<CandidateAccessSubmission>(
    "/interview/candidate-access/submit",
    {
      token,
      browserFingerprint: input?.browserFingerprint,
      answers,
      result,
    },
    { skipAuth: true }
  );
}

export async function runCandidateCode(
  token: string,
  input: RunCandidateCodeInput
): Promise<CandidateRunResult> {
  return client.post<CandidateRunResult>(
    "/interview/candidate-access/run",
    {
      token,
      questionId: input.questionId,
      sourceCode: input.sourceCode,
      files: input.files,
      entryPath: input.entryPath,
      language: input.language,
      stdin: input.stdin,
      browserFingerprint: input.browserFingerprint,
    },
    { skipAuth: true }
  );
}

// ── Proctoring (Layer B / Layer A) ingestion ──────────────────────────────────

/** One client-detected proctoring signal. Metadata only — never frames/images. */
export interface ProctoringEventInput {
  /** Client-generated id for at-least-once dedupe (unique per attempt). */
  clientEventId: string;
  /** snake_case signal type, validated server-side (e.g. "tab_focus_loss", "paste"). */
  type: string;
  /** Detector confidence in [0,1] for model signals; omit for deterministic ones. */
  confidence?: number;
  /** Small context blob, e.g. "pasted:412" — never PII or frames. */
  detail?: string;
  startedAtUtc: string;
  endedAtUtc?: string;
}

export interface SubmitProctoringEventsInput {
  browserFingerprint?: string;
  /** Refresh the attempt heartbeat even if events is empty. */
  heartbeat?: boolean;
  events: ProctoringEventInput[];
}

export interface ProctoringIngestResult {
  accepted: number;
  deduplicated: number;
  dropped: number;
  heartbeatAtUtc?: string;
}

const PROCTORING_EVENTS_PATH = "/interview/candidate-access/proctoring-events";

function toProctoringBody(token: string, input: SubmitProctoringEventsInput) {
  return {
    token,
    browserFingerprint: input.browserFingerprint,
    heartbeat: input.heartbeat ?? false,
    events: input.events,
  };
}

export async function submitProctoringEvents(
  token: string,
  input: SubmitProctoringEventsInput
): Promise<ProctoringIngestResult> {
  return client.post<ProctoringIngestResult>(
    PROCTORING_EVENTS_PATH,
    toProctoringBody(token, input),
    { skipAuth: true }
  );
}

/**
 * Best-effort final delivery that survives page unload, via navigator.sendBeacon. The endpoint is
 * token-gated by the request body (not an auth header), so a beacon works. Returns whether the
 * browser queued it. Mirrors the client's base-URL resolution ("/api" in the browser).
 */
export function beaconProctoringEvents(
  token: string,
  input: SubmitProctoringEventsInput
): boolean {
  if (typeof navigator === "undefined" || typeof navigator.sendBeacon !== "function") {
    return false;
  }

  const base = process.env.NEXT_PUBLIC_API_BASE_URL?.trim() || "/api";
  const url = `${base}${PROCTORING_EVENTS_PATH}`;
  const body = JSON.stringify(toProctoringBody(token, input));

  try {
    return navigator.sendBeacon(url, new Blob([body], { type: "application/json" }));
  } catch {
    return false;
  }
}
