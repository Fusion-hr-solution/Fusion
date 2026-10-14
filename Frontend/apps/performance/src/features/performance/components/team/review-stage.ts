import type { PerformanceReviewState } from "@repo/api";

const REVIEW_STAGE_LABELS: Record<PerformanceReviewState, string> = {
  SelfAssessment: "Self-assessment",
  ManagerAssessment: "Reviewer assessment",
  Calibration: "Calibration",
  ReadyToFinalize: "Ready to finalize",
  Finalized: "Finalized",
  Closed: "Closed",
};

export function reviewStageLabel(state: PerformanceReviewState): string {
  return REVIEW_STAGE_LABELS[state];
}
