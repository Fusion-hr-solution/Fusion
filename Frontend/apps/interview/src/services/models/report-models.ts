import type { BackendCandidateAttemptProctoringSummaryDto } from "./candidate-management-models";

export interface BackendCandidateReportSkillDto {
  key: string;
  scorePct: number;
  cohortAvgPct?: number | null;
  secondsSpent?: number | null;
  allottedSeconds: number;
  questionCount: number;
}

export interface BackendCandidateReportDto {
  testId: string;
  testTitle: string;
  candidateEmail: string;
  candidateName?: string | null;
  attemptNumber: number;
  attemptId?: string | null;
  gradingStatus: string;
  totalScore?: number | null;
  maxScore?: number | null;
  passingThreshold?: number | null;
  submittedAtUtc?: string | null;
  totalDurationSeconds?: number | null;
  axisKind: string;
  cohortSize: number;
  cohortAvailable: boolean;
  cohortUnavailableReason?: string | null;
  overallCohortAvgPct?: number | null;
  skills: BackendCandidateReportSkillDto[];
  proctoring?: BackendCandidateAttemptProctoringSummaryDto | null;
}
