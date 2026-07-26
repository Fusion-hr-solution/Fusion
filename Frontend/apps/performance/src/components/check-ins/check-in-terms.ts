// Single terminology source for the check-in and follow-up surfaces (manager Team progress panel +
// focused check-in detail, and the employee Performance Record surface in My objectives). Product
// language only — no enum or lifecycle codes reach the screen.

import type {
  CheckInStatus,
  DiscussionSignalStatus,
  FollowUpActionOwnerKind,
  FollowUpActionStatus,
} from "@repo/api";

export const checkInTerms = {
  // Panel headings
  panelTitle: "Check-ins",
  conversationTitle: "Check-in",
  signalsTitle: "Wants to discuss",
  upcomingTitle: "Upcoming",
  overdueTitle: "Overdue",
  actionsTitle: "Follow-up actions",
  historyTitle: "Past check-ins",

  // Status (derived / lifecycle)
  planned: "Planned",
  completed: "Completed",
  cancelled: "Cancelled",
  overdue: "Overdue",

  // Empty states — invite the next action, never a dead grey line
  noUpcoming: "No check-in planned",
  noUpcomingHint: "Plan a moment to talk through progress.",
  noHistory: "No check-ins yet",
  noActions: "No open follow-ups",
  noSignals: "Nothing flagged",
  emptyEmployeeUpcoming: "No check-in on the calendar",
  emptyEmployeeUpcomingHint: "Your manager will plan one when it's time to talk.",
  emptyEmployeeActions: "Nothing to follow up on",

  // Plan action
  plan: "Plan check-in",
  planShort: "Plan",
  reschedule: "Reschedule",
  cancel: "Cancel check-in",
  complete: "Complete",
  markComplete: "Mark complete",
  addNote: "Add note",
  addNoteShort: "Note",

  // Plan dialog
  planTitle: "Plan a check-in",
  dateLabel: "Date",
  timeLabel: "Time (optional)",
  reasonLabel: "Focus",
  reasonPlaceholder: "e.g. Mid-cycle progress review",
  agendaLabel: "Agenda (optional)",
  agendaPlaceholder: "Points to cover together",
  linkObjectivesLabel: "Objectives to review (optional)",
  linkSignalsLabel: "Include what they flagged",
  planCta: "Plan check-in",
  planning: "Planning…",

  // Reschedule dialog
  rescheduleTitle: "Reschedule check-in",
  newDateLabel: "New date",
  rescheduleCta: "Reschedule",
  rescheduling: "Rescheduling…",

  // Cancel dialog
  cancelTitle: "Cancel this check-in",
  cancelReasonLabel: "Reason",
  cancelReasonPlaceholder: "Why is this check-in no longer needed?",
  cancelCta: "Cancel check-in",
  cancelling: "Cancelling…",
  keep: "Keep it",

  // Complete dialog
  completeTitle: "Complete this check-in",
  summaryLabel: "What was discussed",
  summaryPlaceholder: "Capture the outcome of the conversation",
  discussedLabel: "Objectives covered",
  agreedActionsLabel: "Agreed follow-ups (optional)",
  addAction: "Add follow-up",
  actionDescriptionPlaceholder: "What needs to happen",
  actionOwnerLabel: "Owner",
  actionDueLabel: "Due",
  completeCta: "Complete check-in",
  completing: "Completing…",
  removeAction: "Remove",

  // Addendum
  addendumTitle: "Notes after the check-in",
  addendumLabel: "Add a note",
  addendumPlaceholder: "Add context — the summary above stays as recorded",
  addendumCta: "Add note",
  addingNote: "Adding…",

  // Response (employee, single, immutable)
  responseTitle: "Your response",
  responseLabel: "Add your response",
  responsePlaceholder: "Share how you see it — you can respond once",
  responseCta: "Send response",
  responseSending: "Sending…",
  responseRecorded: "Response sent",
  responseLocked: "You've already responded to this check-in.",

  // Discussion signal ("Needs discussion")
  needsDiscussion: "Flag for discussion",
  needsDiscussionShort: "Discuss",
  raiseTitle: "Flag this for your next check-in",
  raiseNoteLabel: "Add a note (optional)",
  raiseNotePlaceholder: "What would you like to talk about?",
  raiseCta: "Flag it",
  raising: "Flagging…",
  raised: "Flagged for discussion",
  flaggedBadge: "Flagged",
  resolveSignal: "Resolve",
  closeSignal: "Dismiss",
  closeSignalTitle: "Dismiss this flag",
  closeSignalReasonLabel: "Reason",
  closeSignalReasonPlaceholder: "Why no discussion is needed",
  closeSignalCta: "Dismiss flag",

  // Follow-up action
  markActionDone: "Mark done",
  markingActionDone: "Saving…",
  actionDoneNoteLabel: "Note (optional)",
  actionDoneNotePlaceholder: "Anything to add",
  cancelAction: "Cancel follow-up",
  cancelActionReasonLabel: "Reason",
  ownerYou: "You",
  ownerManager: "Manager",

  // Shared
  linkedObjectives: (count: number) => `${count} objective${count === 1 ? "" : "s"}`,
  actionCount: (count: number) => `${count} follow-up${count === 1 ? "" : "s"}`,
  by: "by",
  createdBy: (name: string) => `Planned by ${name}`,
  conflictRetry: "This check-in changed while you were working. Review the latest and try again.",
  actionConflictRetry: "This follow-up changed. Review the latest and try again.",
  backToTeam: "Back to team progress",
  backToObjectives: "Back to my objectives",
  genericError: "Something went wrong. Try again.",
} as const;

export function checkInStatusLabel(status: CheckInStatus, isOverdue: boolean): string {
  if (status === "Planned" && isOverdue) return checkInTerms.overdue;
  if (status === "Completed") return checkInTerms.completed;
  if (status === "Cancelled") return checkInTerms.cancelled;
  return checkInTerms.planned;
}

export function actionStatusLabel(status: FollowUpActionStatus): string {
  if (status === "Completed") return checkInTerms.completed;
  if (status === "Cancelled") return checkInTerms.cancelled;
  return "Open";
}

export function signalStatusLabel(status: DiscussionSignalStatus): string {
  if (status === "ResolvedByCheckIn") return "Resolved";
  if (status === "Closed") return "Dismissed";
  return checkInTerms.flaggedBadge;
}

export function ownerLabel(kind: FollowUpActionOwnerKind): string {
  return kind === "Employee" ? checkInTerms.ownerYou : checkInTerms.ownerManager;
}
