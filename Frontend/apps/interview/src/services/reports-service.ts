import { createPlatformApiClient } from "@repo/api";
import type {
  CandidateReport,
  CandidateReportSkill,
  ProctoringSeverity,
} from "@/types";
import type {
  BackendCandidateReportDto,
  BackendCandidateReportSkillDto,
} from "./models/report-models";

const client = createPlatformApiClient();

const CANDIDATE_REPORT_ENDPOINT = "/interview/candidates/management/report";

const GRADING_STATUSES: CandidateReport["gradingStatus"][] = [
  "Pending",
  "InProgress",
  "Completed",
  "Failed",
];

function asGradingStatus(value: string): CandidateReport["gradingStatus"] {
  return GRADING_STATUSES.includes(value as CandidateReport["gradingStatus"])
    ? (value as CandidateReport["gradingStatus"])
    : "Pending";
}

function asAxisKind(value: string): CandidateReport["axisKind"] {
  return value === "type" ? "type" : "tag";
}

function nullableNumber(value?: number | null): number | undefined {
  return value ?? undefined;
}

function mapSkill(dto: BackendCandidateReportSkillDto): CandidateReportSkill {
  return {
    key: dto.key,
    scorePct: dto.scorePct,
    cohortAvgPct: nullableNumber(dto.cohortAvgPct),
    secondsSpent: nullableNumber(dto.secondsSpent),
    allottedSeconds: dto.allottedSeconds,
    questionCount: dto.questionCount,
  };
}

function mapReport(dto: BackendCandidateReportDto): CandidateReport {
  return {
    testId: dto.testId,
    testTitle: dto.testTitle,
    candidateEmail: dto.candidateEmail,
    candidateName: dto.candidateName ?? undefined,
    attemptNumber: dto.attemptNumber,
    attemptId: dto.attemptId ?? undefined,
    gradingStatus: asGradingStatus(dto.gradingStatus),
    totalScore: nullableNumber(dto.totalScore),
    maxScore: nullableNumber(dto.maxScore),
    passingThreshold: nullableNumber(dto.passingThreshold),
    submittedAtUtc: dto.submittedAtUtc ?? undefined,
    totalDurationSeconds: nullableNumber(dto.totalDurationSeconds),
    axisKind: asAxisKind(dto.axisKind),
    cohortSize: dto.cohortSize,
    cohortAvailable: dto.cohortAvailable,
    cohortUnavailableReason: dto.cohortUnavailableReason ?? undefined,
    overallCohortAvgPct: nullableNumber(dto.overallCohortAvgPct),
    skills: dto.skills.map(mapSkill),
    proctoring: dto.proctoring
      ? {
          enabled: dto.proctoring.enabled,
          totalEvents: dto.proctoring.totalEvents,
          severity: dto.proctoring.severity as ProctoringSeverity,
          countsByType: dto.proctoring.countsByType.map((item) => ({
            type: item.type,
            count: item.count,
            severity: item.severity as ProctoringSeverity,
          })),
          firstEventAtUtc: dto.proctoring.firstEventAtUtc,
          lastEventAtUtc: dto.proctoring.lastEventAtUtc,
          lastHeartbeatAtUtc: dto.proctoring.lastHeartbeatAtUtc,
          heartbeatGapSeconds: dto.proctoring.heartbeatGapSeconds,
          wentDark: dto.proctoring.wentDark,
        }
      : undefined,
  };
}

export async function getCandidateReport(
  testId: string,
  candidateEmail: string,
  attemptNumber?: number
): Promise<CandidateReport> {
  const dto = await client.get<BackendCandidateReportDto>(CANDIDATE_REPORT_ENDPOINT, {
    params: {
      testId,
      candidateEmail,
      ...(attemptNumber ? { attemptNumber } : {}),
    },
  });

  return mapReport(dto);
}
