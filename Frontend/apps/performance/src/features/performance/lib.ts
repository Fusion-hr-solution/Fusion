import type {
  CycleSummaryDto,
  MeasurementDto,
  MeasurementMethod,
  OperationalMilestone,
  ReadinessIssueCode,
} from "@repo/api";

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

export const READINESS_LABELS: Record<ReadinessIssueCode, string> = {
  InactiveEmployment: "Inactive employment",
  NoPrimaryAssignment: "No primary assignment",
  MissingManager: "No manager on record",
};

export function formatDate(value: string | null | undefined): string {
  if (!value) return "—";
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
}

export function formatDateRange(start: string, end: string): string {
  return `${formatDate(start)} – ${formatDate(end)}`;
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
      return "Manual completion %";
  }
}

/**
 * The tenant's primary Cycle for the workspace: the Active one if it exists, otherwise the most
 * recent Draft, otherwise the most recent of any state. One living Cycle, not a table.
 */
export function selectPrimaryCycle(cycles: CycleSummaryDto[] | undefined): CycleSummaryDto | null {
  if (!cycles || cycles.length === 0) return null;
  const active = cycles.find((cycle) => cycle.state === "Active");
  if (active) return active;
  const drafts = cycles.filter((cycle) => cycle.state === "Draft");
  if (drafts.length > 0) return drafts[0] ?? null;
  return cycles[0] ?? null;
}
