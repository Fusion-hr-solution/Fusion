import type {
  ContributionLinkDto,
  GoalDetailDto,
  GoalNodeDto,
  MeasurementDto,
  ObjectiveProgressSource,
  PersonRefDto,
} from "@repo/api";
import type { ObjectiveRef } from "./objective-ref";

/**
 * The one shape every objective takes inside the record, whatever its scope. It is built from the
 * canonical objective detail alone (the record never borrows a caller's copy), so an objective reads
 * the same wherever it is opened from, and every action it offers comes from the server's capabilities.
 */
export type ObjectiveRecord = {
  ref: ObjectiveRef;
  kind: "company" | "team" | "plan";
  /** "Company strategic objective", "Talent Pod objective", "Aligned objective"… */
  kindLabel: string;
  title: string;
  description: string | null;
  /** Aligned objectives (and all direction) read in the primary accent; a standalone plan objective in info. */
  accent: "primary" | "info";
  isAligned: boolean;
  status: { label: string; tone: "neutral" | "info" | "success" | "warning" | "muted" };
  accountable: PersonRefDto;
  parent: { ref: ObjectiveRef; title: string; scopeLabel: string; archived: boolean } | null;
  children: GoalNodeDto[];
  measurement: MeasurementDto | null;
  progressSource: ObjectiveProgressSource;
  startDate: string;
  endDate: string;
  /** A plan objective's share of its plan; null for direction. */
  planWeight: number | null;
  /** Execution has begun — the plan is approved, or the direction is published — so progress is meaningful. */
  isExecuting: boolean;
  progress: { has: boolean; derived: number; coverage: number | null };
  contribution: { links: ContributionLinkDto[]; locked: boolean };
  can: {
    edit: boolean;
    publish: boolean;
    archive: boolean;
    remove: boolean;
    updateProgress: boolean;
    readProgressHistory: boolean;
    configureContribution: boolean;
  };
  /** The canonical detail the record was built from, for sections that edit it (contribution). */
  source: GoalDetailDto;
};

/**
 * Where this objective sits on the alignment map: itself when it is published direction; for an aligned
 * personal objective, itself under its parent (`near` is the parent, for when the plan has not been put
 * forward and the objective is not on the map yet). Draft and standalone objectives are not on the map.
 */
export function mapFocusFor(record: ObjectiveRecord): { focus: string; near: string | null } | null {
  if (record.kind === "plan")
    return record.isAligned && record.parent ? { focus: record.ref.objectiveId, near: record.parent.ref.objectiveId } : null;
  return record.source.node.state === "Published" ? { focus: record.ref.objectiveId, near: null } : null;
}

export function toObjectiveRecord(detail: GoalDetailDto): ObjectiveRecord {
  const node = detail.node;
  const kind = node.ownershipScope === "Company" ? "company" : node.ownershipScope === "OrgUnit" ? "team" : "plan";
  const isAligned = node.parentObjectiveId != null;
  const planState = detail.plan?.planState ?? null;

  return {
    ref: { cycleId: detail.cycleId, objectiveId: node.id },
    kind,
    kindLabel:
      kind === "company"
        ? "Company strategic objective"
        : kind === "team"
          ? `${node.orgUnitName ?? "Organizational"} objective`
          : isAligned
            ? "Aligned objective"
            : "Standalone role objective",
    title: node.title,
    description: detail.description,
    accent: kind === "plan" && !isAligned ? "info" : "primary",
    isAligned,
    status:
      kind === "plan"
        ? planState === "Approved"
          ? { label: "Approved", tone: "success" }
          : planState === "Submitted"
            ? { label: "Submitted", tone: "info" }
            : { label: "Draft plan", tone: "muted" }
        : node.state === "Published"
          ? { label: "Published", tone: "success" }
          : node.state === "Archived" ? { label: "Archived", tone: "muted" } : { label: "Draft", tone: "muted" },
    accountable: detail.accountable,
    parent: detail.parent
      ? {
          ref: { cycleId: detail.cycleId, objectiveId: detail.parent.id },
          title: detail.parent.title,
          scopeLabel: directionScopeLabel(detail.parent),
          archived: detail.parent.state === "Archived",
        }
      : null,
    children: detail.children,
    measurement: detail.measurement,
    progressSource: node.progressSource,
    startDate: node.startDate,
    endDate: node.endDate,
    planWeight: kind === "plan" ? (detail.plan?.planWeight ?? null) : null,
    isExecuting: kind === "plan" ? planState === "Approved" : node.state !== "Draft",
    progress: { has: node.hasProgress, derived: node.derivedProgress, coverage: node.progressCoverage },
    contribution: { links: detail.contribution, locked: node.isContributionBaselineLocked },
    can: {
      edit: detail.canEdit,
      publish: detail.canPublish,
      archive: detail.canArchive,
      remove: detail.canDelete,
      updateProgress: detail.canUpdateProgress,
      readProgressHistory: detail.canReadProgressHistory,
      configureContribution: detail.canConfigureContribution,
    },
    source: detail,
  };
}

/** Where a direction objective sits: company strategy, or the unit that owns it. */
export function directionScopeLabel(node: Pick<GoalNodeDto, "ownershipScope" | "orgUnitName">): string {
  return node.ownershipScope === "Company" ? "Company strategy" : (node.orgUnitName ?? "Organizational");
}

export type RecordSectionId =
  | "description"
  | "alignment"
  | "measurement"
  | "timeline"
  | "plan-weight"
  | "progress"
  | "aligned-children"
  | "contribution";

/** One row of the record's body: a section on its own, or two read side by side. */
export type RecordSectionRow = RecordSectionId | readonly [RecordSectionId, RecordSectionId];

/**
 * Which sections this record shows, in reading order. A section appears only when it has something true
 * to say: no empty description block, no progress before execution begins, no contribution on a directly
 * measured objective. The record's shell renders exactly this list and holds no section logic itself.
 */
export function resolveSections(record: ObjectiveRecord): RecordSectionRow[] {
  const rows: RecordSectionRow[] = [];
  if (record.description) rows.push("description");
  if (record.parent) rows.push("alignment");
  rows.push("measurement");
  rows.push(record.planWeight != null ? (["timeline", "plan-weight"] as const) : "timeline");
  if (record.isExecuting) rows.push("progress");
  if (record.kind !== "plan" && (record.children.length > 0 || record.source.alignedPlanObjectives.length > 0)) rows.push("aligned-children");
  if (record.progressSource === "Calculated") rows.push("contribution");
  return rows;
}

/** Today on the objective's window, only while the window is running. */
export function todayMarker(start: string, end: string, now = new Date()): { date: string; label: string } | null {
  const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  return today >= start.slice(0, 10) && today <= end.slice(0, 10) ? { date: today, label: "Today" } : null;
}

/** The window's length in plain units: days under two months, months otherwise. */
export function windowLength(start: string, end: string): string {
  const days = Math.round((Date.parse(end) - Date.parse(start)) / 86_400_000) + 1;
  if (!Number.isFinite(days) || days <= 0) return "Objective window";
  if (days < 60) return `${days} days`;
  return `${Math.round(days / 30.44)} months`;
}

/** How this objective's progress is read, stated from its measurement method. */
export function measurementSubtitle(measurement: MeasurementDto | null, source?: ObjectiveProgressSource): string {
  if (source === "Calculated") return "Rolled up from the objectives that contribute to it.";
  switch (measurement?.method) {
    case "NumericTarget":
      return "Tracked against a numeric target.";
    case "WeightedMilestones":
      return "Tracked across weighted milestones.";
    case "ManualPercentage":
      return "Progress is updated manually during the cycle.";
    default:
      return "How progress is measured this cycle.";
  }
}

export function measureLabel(measurement: MeasurementDto | null): string {
  if (!measurement) return "—";
  if (measurement.method === "NumericTarget") {
    if (measurement.unit === "%") return "Percentage";
    return measurement.unit ? `In ${measurement.unit}` : "Numeric value";
  }
  if (measurement.method === "WeightedMilestones") {
    return `${measurement.milestones.length} milestone${measurement.milestones.length === 1 ? "" : "s"}`;
  }
  return "Single percentage";
}
