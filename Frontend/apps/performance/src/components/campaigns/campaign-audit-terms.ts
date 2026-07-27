/**
 * Wording for the campaign change history.
 *
 * The stored actions are internal enum names; nobody outside the codebase should have to read
 * `PlanningRulesSnapshotCaptured`. This maps them to what actually happened, and falls back to a
 * spaced-out form so a newly added action degrades to something readable rather than to a blank.
 */
const ACTION_LABELS: Record<string, string> = {
  Created: "Campaign created",
  Updated: "Details updated",
  PopulationUpdated: "Population changed",
  ApproverOverridden: "Approver overridden",
  CampaignLaunched: "Campaign launched",
  CampaignClosed: "Campaign closed",
  EvaluationRoundClosed: "Evaluation round closed",
  GovernanceConfigured: "Governance configured",
  GovernanceFrozen: "Governance frozen",
  PlanningRulesSnapshotCaptured: "Planning rules captured",
  StrategicObjectiveAdded: "Strategic objective added",
  StrategicObjectiveUpdated: "Strategic objective updated",
  StrategicObjectiveToggled: "Strategic objective paused or resumed",
  TeamObjectiveCreated: "Team objective added",
  TeamObjectiveUpdated: "Team objective updated",
  TeamObjectiveDeleted: "Team objective deleted",
  EmployeeObjectivePlanCreated: "Objective plan started",
  EmployeeObjectivePlanSubmitted: "Objective plan submitted",
  PlanningReminderRecorded: "Reminder recorded",
  PlanningReminderTriggered: "Reminder sent",
  PlanningApproverReassigned: "Reviewer reassigned",
  PlanningParticipantExcluded: "Participant excluded",
  PlanningLockRejected: "Planning lock rejected",
  PlanningLocked: "Planning locked",
  ObjectiveProgressCorrected: "Progress corrected",
};

export const campaignAuditTerms = {
  title: "Change history",
  loading: "Loading history…",
  failed: "Could not load the change history.",
  retry: "Try again",
  empty: "Nothing has changed on this campaign yet.",
  count: (total: number) => `${total} ${total === 1 ? "change" : "changes"}`,
  by: (actor: string) => `by ${actor}`,
  /** No actor: the platform did it, not a person. */
  bySystem: "automatically",
  pageOf: (page: number, total: number) => `${page} / ${total}`,
  newer: "Newer",
  older: "Older",

  action: (action: string): string =>
    ACTION_LABELS[action] ?? action.replace(/([A-Z])/g, " $1").trim(),
} as const;
