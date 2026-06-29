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
    },
    { skipAuth: true }
  );
}
