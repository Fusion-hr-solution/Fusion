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
  evaluationCriteria?: string;
  options: CandidateAccessQuestionOption[];
}

export interface CandidateAccessValidation {
  isValid: boolean;
  canStart: boolean;
  canResume: boolean;
  canSubmit: boolean;
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

export async function startCandidateAttempt(token: string): Promise<CandidateAccessSession> {
  return client.post<CandidateAccessSession>(
    "/interview/candidate-access/start",
    { token },
    { skipAuth: true }
  );
}

export async function submitCandidateAttempt(
  token: string,
  answers: unknown,
  result: unknown
): Promise<CandidateAccessSubmission> {
  return client.post<CandidateAccessSubmission>(
    "/interview/candidate-access/submit",
    {
      token,
      answers,
      result,
    },
    { skipAuth: true }
  );
}
