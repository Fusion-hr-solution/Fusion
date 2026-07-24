import type { StatusTone } from "@repo/ds/shell";
import type {
  EvaluationAssessmentModel,
  EvaluationRoundType,
  TeamQueueItemDto,
} from "@repo/api";

/**
 * Single terminology source for every evaluation execution surface.
 * All user-visible strings and status→tone mappings live here — no screen
 * renders a backend enum or invents its own wording.
 */
export const evaluationTerms = {
  // Doors
  myEvaluationsTitle: "My evaluations",
  teamEvaluationsTitle: "Team evaluations",
  noEvaluationWork: "No evaluation work",
  noTeamRounds: "No team reviews",
  accessRequired: "Evaluation access is required.",
  loadFailed: "Evaluations could not be loaded",

  // Workspace sections
  sections: {
    objectives: "Objectives",
    skills: "Skills",
    questions: "Questions",
    decision: "Decision",
  },

  // Self assessment
  selfWorkspaceUnavailable: "Evaluation unavailable",
  submitSelf: "Submit self-assessment",
  submittedNotice: "Submitted — locked until your manager finalizes.",
  awaitingManagerTitle: "Awaiting your manager's review",
  awaitingManagerNotice: "Your result appears here once finalized.",
  reopenedNotice: "Reopened by your manager — review and resubmit.",

  // Result & acknowledgement
  finalResult: "Final result",
  objectivesArea: "Objectives",
  skillsArea: "Skills",
  discussionSummary: "Discussion summary",
  acknowledge: "Acknowledge result",
  acknowledgementPlaceholder: "Optional comment for the record",
  acknowledgedOn: (date: string) => `Acknowledged ${date}`,
  yourRating: "You",
  managerRating: "Manager",
  expectedLevel: "Expected",

  // Manager flow
  recordAssessment: "Record assessment",
  assessmentRecorded: "Assessment recorded",
  finalize: "Finalize evaluation",
  finalized: "Finalized",
  reopenSelf: "Reopen self-assessment",
  reopenReasonLabel: "Reason shared with the employee",
  noSelfSubmission: "No self-assessment was submitted before the deadline.",
  awaitingSelf: "Awaiting self-assessment",
  materialDifference: "Material difference",
  weightedPreview: "Weighted result",

  // Save state
  saving: "Saving…",
  saved: "Saved",
  saveConflict: "Updated elsewhere — reload to continue.",
  reload: "Reload",

  // Questions
  notApplicable: "Not applicable",
  notApplicableReason: "Why doesn't this apply?",
  requiredQuestion: "Required",

  // Queue grouping
  queueGroups: {
    readyToFinalize: "Ready to finalize",
    inAssessment: "In assessment",
    awaitingEmployee: "Awaiting employee",
    awaitingAcknowledgement: "Awaiting acknowledgement",
    done: "Done",
  },
} as const;

// ─── Round type ──────────────────────────────────────────────────────────────

const ROUND_TYPE_LABELS: Record<EvaluationRoundType, string> = {
  MidCycle: "Mid-cycle review",
  YearEnd: "Year-end review",
  SpecificReview: "Focused review",
};

export function roundTypeLabel(type: EvaluationRoundType): string {
  return ROUND_TYPE_LABELS[type] ?? type;
}

export function assessmentModelLabel(model: EvaluationAssessmentModel): string {
  return model === "ManagerOnly"
    ? "Manager assessment"
    : "Self and manager assessment";
}

// ─── Assignment / participant states ─────────────────────────────────────────

/**
 * Raw values seen from the API: assignment statuses (NotStarted, InProgress,
 * Submitted, Finalized), employee-list states ("Not started", "In progress",
 * "Submitted", "Finalized", "Acknowledged") and the AwaitingManager projection.
 */
const STATE_LABELS: Record<string, string> = {
  NotStarted: "Not started",
  "Not started": "Not started",
  InProgress: "In progress",
  "In progress": "In progress",
  Submitted: "Submitted",
  Finalized: "Finalized",
  Acknowledged: "Acknowledged",
  AwaitingManager: "Awaiting manager",
};

const STATE_TONES: Record<string, StatusTone> = {
  NotStarted: "neutral",
  "Not started": "neutral",
  InProgress: "info",
  "In progress": "info",
  Submitted: "warning",
  Finalized: "success",
  Acknowledged: "success",
  AwaitingManager: "muted",
};

export function evaluationStateLabel(status: string): string {
  return STATE_LABELS[status] ?? status;
}

export function evaluationStateTone(status: string): StatusTone {
  return STATE_TONES[status] ?? "neutral";
}

// ─── Gap states ──────────────────────────────────────────────────────────────

export function gapStateLabel(gap: "Below" | "Meets" | "Exceeds"): string {
  return gap === "Below"
    ? "Below expected"
    : gap === "Exceeds"
      ? "Above expected"
      : "At expected";
}

export function gapStateTone(gap: "Below" | "Meets" | "Exceeds"): StatusTone {
  return gap === "Below" ? "warning" : gap === "Exceeds" ? "success" : "neutral";
}

// ─── Team queue grouping ─────────────────────────────────────────────────────

export type QueueGroupId =
  | "readyToFinalize"
  | "inAssessment"
  | "awaitingEmployee"
  | "awaitingAcknowledgement"
  | "done";

export function queueGroupFor(item: TeamQueueItemDto): QueueGroupId {
  if (item.status === "Finalized")
    return item.acknowledgedAt ? "done" : "awaitingAcknowledgement";
  if (!item.actionable) return "awaitingEmployee";
  if (item.status === "Submitted") return "readyToFinalize";
  return "inAssessment";
}

export const QUEUE_GROUP_ORDER: QueueGroupId[] = [
  "readyToFinalize",
  "inAssessment",
  "awaitingEmployee",
  "awaitingAcknowledgement",
  "done",
];
