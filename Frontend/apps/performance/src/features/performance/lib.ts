import type {
  MeasurementDto,
  MeasurementMethod,
  OperationalMilestone,
  ReadinessIssueCode,
} from "@repo/api";
import { formatDate as formatSharedDate, formatDateRange as formatSharedRange, formatDateTime as formatSharedDateTime, formatRelative } from "@repo/ds/lib/dates";

export const MEASUREMENT_LABELS: Record<MeasurementMethod, string> = {
  ManualPercentage: "Manual percentage",
  NumericTarget: "Numeric target",
  WeightedMilestones: "Weighted milestones",
};

export const MILESTONE_LABELS: Record<OperationalMilestone, string> = {
  StrategicDirectionPublished: "Direction published",
  PopulationConfirmed: "Population confirmed",
  PlanningOpened: "Planning opened",
  PlanningCompleted: "Planning completed",
  PerformanceEndReached: "Performance end",
  ClosureReady: "Closure ready",
};

/**
 * The secondary detail line for a readiness issue, dated to the cycle's eligibility date where it
 * matters. The short title comes from the server (`issue.label`); this composes the specific
 * consequence the admin needs to act on.
 */
export function readinessIssueDetail(code: ReadinessIssueCode, eligibilityDate: string): string {
  switch (code) {
    case "InactiveEmployment":
      return `Employment is not active as of ${formatDate(eligibilityDate)}.`;
    case "NoPrimaryAssignment":
      return `No active primary assignment as of ${formatDate(eligibilityDate)}.`;
    case "MissingManager":
      return "A valid manager is required for plan reviews.";
    case "InactiveManager":
      return `The assigned manager is not active as of ${formatDate(eligibilityDate)}.`;
    default:
      return "";
  }
}

/** A calendar date in Fusion's one date grammar ("20 Oct", "20 Oct 2025"). */
export function formatDate(value: string | null | undefined): string {
  return formatSharedDate(value);
}

/** A date range with the shared year said once ("10 Oct – 9 Nov 2026"); `omitYear` where the cycle already gives it. */
export function formatDateRange(start: string, end: string, options?: { omitYear?: boolean }): string {
  return formatSharedRange(start, end, options);
}

/** A full ISO timestamp as a readable day and time ("Tue 20 Oct, 15:24"). */
export function formatDateTime(value: string | null | undefined): string {
  return formatSharedDateTime(value);
}

/** A timestamp as recency for scanning ("12 min ago", "Yesterday", "4 days ago", then the date). */
export function formatRelativeTime(value: string | null | undefined, now: Date = new Date()): string {
  return formatRelative(value, now);
}

/**
 * Parses a user-typed measurement value, distinguishing empty (nothing entered yet) from
 * non-numeric (e.g. "48M"). Non-numeric input is reported as invalid so the composer can show
 * inline guidance instead of silently disabling submission.
 */
export function parseNumeric(value: string): { num: number | null; invalid: boolean } {
  const trimmed = value.trim();
  if (trimmed === "") return { num: null, invalid: false };
  const num = Number(trimmed);
  return Number.isFinite(num) ? { num, invalid: false } : { num: null, invalid: true };
}

export function measurementSummary(measurement: MeasurementDto): string {
  switch (measurement.method) {
    case "NumericTarget": {
      const arrow = measurement.direction === "Decrease" ? "↓" : "↑";
      return `${measurement.baseline ?? "?"} ${arrow} ${measurement.target ?? "?"} ${measurement.unit ?? ""}`.trim();
    }
    case "WeightedMilestones":
      return `${measurement.milestones.length} milestone${measurement.milestones.length === 1 ? "" : "s"}`;
    case "ManualPercentage":
    default:
      return "Manual percentage";
  }
}
