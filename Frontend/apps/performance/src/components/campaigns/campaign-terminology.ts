export const campaignTerms = {
  navLabel: "Campaigns",
  listTitle: "Campaigns",
  newTitle: "New campaign",
  setupTitle: "Campaign setup",
  createAction: "Create campaign",
  saveAction: "Save changes",
  addObjectiveAction: "Add objective",
  identity: "Identity",
  schedule: "Planning schedule",
  rules: "Planning rules",
  strategicObjectives: "Strategic objectives",
  readOnly: "Read only",
} as const;

/**
 * Planning-schedule milestones, worded from the campaign's perspective.
 * Order is defined by SCHEDULE_STEPS in the campaigns page; the keys match the
 * PerformanceCycle schedule fields.
 */
export const campaignScheduleSteps = {
  planningOpeningDate: {
    label: "Employee planning opens",
    caption: "Employees can start entering their objective plans.",
    short: "planning opens",
  },
  employeeSubmissionDeadline: {
    label: "Plans due for submission",
    caption: "Employees submit plans for manager review.",
    short: "employee submission",
  },
  managerApprovalDeadline: {
    label: "Manager approval due",
    caption: "Managers review and approve submitted plans.",
    short: "manager approval",
  },
  expectedPlanningLockDate: {
    label: "Planning lock target",
    caption: "Target date to lock the approved plan baseline.",
    short: "planning lock",
  },
} as const;

/** Setup-readiness copy for the right-rail progress card. */
export const campaignReadiness = {
  title: "Setup readiness",
  readyForPopulation: "Ready for population",
  remaining: (count: number) => `${count} to go`,
  completeFooter: "This campaign has everything it needs to be populated.",
  incompleteFooter: "Finish the remaining items to complete setup.",
  items: {
    identity: "Name and reference year",
    schedule: "Planning schedule set and in order",
    rules: "Objective rules captured",
    objective: "At least one active objective",
  },
} as const;

/** The focused "start a campaign" dialog that mints a draft, then opens its workspace. */
export const campaignCreateDialog = {
  title: "Start a campaign",
  description: "Name it and pick its year — schedule and objectives come next.",
  nameLabel: "Campaign name",
  namePlaceholder: "e.g. FY26 Annual Planning",
  yearLabel: "Reference year",
  submit: "Create & set up",
  submitting: "Creating…",
  cancel: "Cancel",
  duplicateFallback: "A campaign with this name already exists.",
  permissionDenied: "You do not have permission to create campaigns.",
} as const;

/** Discarding a draft campaign from its workspace. */
export const campaignDiscard = {
  action: "Discard campaign",
  title: "Discard this campaign?",
  description:
    "This permanently deletes the draft and everything set up in it. This can't be undone.",
  confirm: "Discard campaign",
  cancel: "Keep campaign",
  success: "Campaign discarded",
} as const;

/** Objective-planning population scope surface. */
export const campaignPopulation = {
  title: "Participants",
  description: "Who takes part in this campaign's objective planning.",
  allActiveTitle: "All active employees",
  allActiveCaption:
    "Everyone active in your organization participates. Narrow this by adding an org-unit scope.",
  scopedCaption: (count: number) =>
    `${count} ${count === 1 ? "org-unit scope" : "org-unit scopes"} selected.`,
  addScope: "Add org unit",
  includeDescendants: "Include sub-units",
  scopesHeading: "Org-unit scopes",
  exclusionsHeading: "Excluded people",
  addExclusion: "Exclude someone",
  exclusionReasonLabel: "Reason for exclusion",
  exclusionReasonPlaceholder: "e.g. On extended leave",
  exclusionReasonRequired: "A reason is required to exclude someone.",
  resolvedCount: (count: number) =>
    `${count} ${count === 1 ? "person participates" : "people participate"}`,
  previewEmpty: "No one is resolved into this campaign yet.",
  remove: "Remove",
} as const;

/** Launch readiness review surface. */
export const campaignReadinessReview = {
  title: "Launch readiness",
  ready: "Ready to launch",
  notReady: "Not ready yet",
  participantsHeading: "Participants & approvers",
  approver: "Approver",
  defaultApprover: "Manager",
  overriddenApprover: "Overridden",
  overrideAction: "Change approver",
  missingApprover: "No approver",
  excludedHeading: "Excluded",
  blockingHeading: "Resolve before launch",
  informationalHeading: "Worth a glance",
  overrideReasonLabel: "Why change the approver?",
  overrideReasonPlaceholder: "e.g. Direct manager is on leave",
  overrideApproverLabel: "New approver",
  overrideSubmit: "Set approver",
  overrideSubmitting: "Setting…",
} as const;

/** The launch commit — the earned climactic moment. */
export const campaignLaunch = {
  action: "Launch campaign",
  blockedHint: "Resolve the items above to launch.",
  title: "Launch this campaign?",
  frozenSummary: (count: number) =>
    `${count} ${count === 1 ? "participant" : "participants"} and their approvers will be frozen as this campaign's baseline.`,
  irreversible: "This is final — setup becomes read-only.",
  scheduleNote: (date: string) =>
    `Entry opens on schedule (${date}), not at launch.`,
  confirm: "Launch now",
  launching: "Launching…",
  cancel: "Not yet",
  success: "Campaign launched",
  launchedTitle: "Launched",
  launchedCaption: (count: number, date: string) =>
    `Baseline frozen with ${count} ${count === 1 ? "participant" : "participants"} on ${date}.`,
  baselineHeading: "Frozen baseline",
} as const;

/**
 * Manager team-objective workspace (P1.3). Saved is the only state a team objective has —
 * never use draft/published/approved wording here.
 */
export const teamObjectiveTerms = {
  navLabel: "Team objectives",
  listTitle: "Team objectives",
  teamTitle: "Your team",
  addAction: "Add",
  translateAction: "Translate this pillar",
  cascadeMeter: (translated: number, total: number) =>
    `${translated}/${total} ${total === 1 ? "pillar" : "pillars"}`,
  emptyList: {
    title: "No campaigns waiting for you",
    description: "You're not responsible for anyone in a launched campaign yet.",
  },
  noLinkedEmployee: "Your account isn't linked to an employee record.",
  availabilityNote: (date: string) => `Team sees these ${date}`,
  availabilityNoteOpen: "Live for your team",
  scopeParticipants: (count: number) => `${count} ${count === 1 ? "person" : "people"}`,
  objectiveCount: (count: number) =>
    `${count} ${count === 1 ? "objective" : "objectives"}`,
  moreInScope: (count: number) => `+${count} more`,
} as const;

/** The single create/edit business action for a team objective. */
export const teamObjectiveEditor = {
  createTitle: "Add a team objective",
  editTitle: "Edit team objective",
  strategicLabel: "Strategy pillar",
  titleLabel: "Team objective",
  titlePlaceholder: "e.g. Raise client delivery NPS in our accounts",
  successCriteriaLabel: "Success looks like",
  successCriteriaPlaceholder: "e.g. NPS above 60 across our accounts by Q4",
  measurementLabel: "Measured",
  descriptionLabel: "Context for your team (optional)",
  descriptionPlaceholder: "Anything your team should know about this objective.",
  submitCreate: "Save team objective",
  submitEdit: "Save changes",
  submitting: "Saving…",
  cancel: "Cancel",
  created: "Team objective saved",
  updated: "Team objective updated",
  conflict:
    "This objective changed in another session. Review the latest version and try again — your entries are preserved.",
  deleteAction: "Delete",
  deleteTitle: "Delete this team objective?",
  deleteDescription:
    "It will be removed from the campaign cascade. This can't be undone.",
  deleteConfirm: "Delete objective",
  deleteCancel: "Keep objective",
  deleted: "Team objective deleted",
} as const;

/** Direction strategy door + the shared cascade coverage surface (informational, never blocking). */
export const strategyTerms = {
  navLabel: "Strategy",
  listTitle: "Strategy",
  emptyList: {
    title: "No launched campaigns",
    description: "Campaign strategy appears here once a campaign is launched.",
  },
  coverageTitle: "Cascade coverage",
  pillarsTranslated: "Pillars translated",
  managersContributing: "Managers contributing",
  teamObjectivesLabel: "Team objectives",
  pillarsHeading: "Strategy pillars",
  managersHeading: "Managers",
  managerScope: (count: number) =>
    `${count} ${count === 1 ? "participant" : "participants"}`,
  objectiveCount: (count: number) =>
    `${count} ${count === 1 ? "objective" : "objectives"}`,
  noObjectivesYet: "None yet",
  allObjectivesHeading: "Team objectives",
} as const;

export type CampaignTone = "neutral" | "info" | "success" | "warning";

export function campaignStatusLabel(status: string): string {
  switch (status) {
    case "Draft":
      return "In setup";
    case "Launched":
      return "Launched";
    case "Active":
      return "Active";
    case "Closed":
      return "Closed";
    default:
      return status;
  }
}

export function campaignStatusTone(status: string): CampaignTone {
  switch (status) {
    case "Launched":
    case "Active":
      return "success";
    case "Closed":
      return "neutral";
    default:
      return "info";
  }
}
