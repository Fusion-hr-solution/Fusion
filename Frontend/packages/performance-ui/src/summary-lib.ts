import type { ReactNode } from "react";
import type { PerformanceReviewState, PersonSummaryCurrentReviewDto, RosterPlanStatus } from "@repo/api";

/**
 * Renders a link. Performance passes `next/link`; Core HR passes a plain anchor, because Performance
 * paths are another app and need a full navigation.
 */
export type RenderSummaryLink = (props: { href: string; className?: string; children: ReactNode }) => ReactNode;

export const PLAN_STATUS_LABEL: Record<RosterPlanStatus, string> = {
  NotStarted: "Not started",
  Draft: "Draft",
  ReturnedForChanges: "Returned for changes",
  Submitted: "Waiting for approval",
  Approved: "Approved",
};

export type ReviewStep = Exclude<PerformanceReviewState, "Closed">;

export function reviewSteps(review: Pick<PersonSummaryCurrentReviewDto, "selfAssessmentEnabled" | "calibrationEnabled">): ReviewStep[] {
  return (["SelfAssessment", "ManagerAssessment", "Calibration", "ReadyToFinalize", "Finalized"] as const).filter(
    (step) => (step !== "SelfAssessment" || review.selfAssessmentEnabled) && (step !== "Calibration" || review.calibrationEnabled),
  );
}

export function stepLabel(step: ReviewStep): string {
  switch (step) {
    case "SelfAssessment":
      return "Self-assessment";
    case "ManagerAssessment":
      return "Reviewer assessment";
    case "ReadyToFinalize":
      return "Ready to finalize";
    default:
      return step;
  }
}

/** Whole percents unless the figure carries decimals. */
export function percent(value: number): string {
  const rounded = Math.round(value * 10) / 10;
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
}

export function formatDate(iso: string): string {
  const [y, m, d] = iso.slice(0, 10).split("-").map(Number);
  return new Date(y!, (m ?? 1) - 1, d ?? 1).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}
