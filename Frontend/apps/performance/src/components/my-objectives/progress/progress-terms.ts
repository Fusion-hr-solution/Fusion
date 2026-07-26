// Single terminology source for the objective-progress surfaces (employee My objectives after
// planning lock, and the manager Team progress door). Product language only — no enum or lifecycle
// codes reach the screen.

export const progressTerms = {
  // Plan-level hero
  planProgress: "Plan progress",
  ofObjectivesComplete: (done: number, total: number) => `${done} of ${total} complete`,
  staleCount: (count: number) => `${count} need${count === 1 ? "s" : ""} an update`,
  everythingCurrent: "Everything's up to date",

  // Objective state (derived)
  notStarted: "Not started",
  inProgress: "In progress",
  completed: "Completed",
  stale: "Needs update",
  lastUpdated: (when: string) => `Updated ${when}`,
  neverUpdated: "No update yet",
  updateCount: (count: number) => `${count} update${count === 1 ? "" : "s"}`,

  // Baseline context labels
  weight: "Weight",
  target: "Target",
  due: "Due",
  supports: "Supports",

  // Record action
  recordProgress: "Record progress",
  updateProgress: "Update progress",
  firstUpdate: "Log first progress",

  // Record dialog
  dialogTitle: "Record progress",
  currentValue: "Current",
  newValue: "New progress",
  progressLabel: "Progress",
  actualLabel: "Actual result (optional)",
  actualPlaceholder: "e.g. 1.05M reached",
  commentLabel: "What changed (optional)",
  commentPlaceholder: "Add context for this update",
  evidenceLabel: "Evidence (optional)",
  evidenceAdd: "Attach file",
  regressionTitle: "This lowers your progress",
  regressionBody: (from: number, to: number) =>
    `You're moving from ${from}% down to ${to}%. Confirm and tell your manager why.`,
  regressionConfirm: "Yes, progress moved back",
  regressionReasonLabel: "Reason",
  regressionReasonPlaceholder: "Why did this objective move backwards?",
  save: "Record",
  saving: "Recording…",
  cancel: "Cancel",
  recordedToast: "Progress recorded",
  conflictRetry: "Progress changed while you were recording. Review the latest value and try again.",

  // History timeline
  historyTitle: "Progress history",
  historyEmpty: "No progress recorded yet.",
  regressionTag: "Moved back",
  completedTag: "Reached 100%",
  reopenedTag: "Reopened",
  from: "from",
  by: "by",
  evidenceOne: "1 file",
  evidenceMany: (count: number) => `${count} files`,
} as const;

export const teamProgressTerms = {
  listTitle: "Team progress",
  accessTitle: "Team progress access required",
  emptyListTitle: "No team progress to follow yet",
  emptyListDescription:
    "When one of your campaigns locks planning and assigns you participants, they'll appear here.",
  emptyScopeTitle: "No one to follow here yet",
  emptyScopeDescription:
    "No locked campaign currently assigns you participants to follow.",
  needsAttention: "Needs attention",
  onTrack: "On track",
  attentionCount: (count: number) => `${count} need${count === 1 ? "s" : ""} attention`,
  allOnTrack: "Everyone's on track",
  participants: (count: number) => `${count} ${count === 1 ? "person" : "people"}`,
  notStartedSignal: (count: number) => `${count} not started`,
  staleSignal: (count: number) => `${count} stale`,
  regressionSignal: "Recent setback",
  viewDetail: "View progress",
  backToTeam: "Back to team progress",
  lastActivity: (when: string) => `Last activity ${when}`,
  noActivity: "No activity yet",
} as const;
