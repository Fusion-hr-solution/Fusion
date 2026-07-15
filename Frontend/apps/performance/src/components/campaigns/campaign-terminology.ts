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

/** Planning journey — the campaign's date sequence shown as windows between milestones. */
export const campaignJourney = {
  spanUnit: "days",
  spanLead: "end to end",
  spanEmpty: "Set the milestone dates",
  gapDays: (days: number) => `${days}d`,
  mustFollow: (short: string) => `Must be on or after ${short}.`,
} as const;

/** Strategy board — the campaign's strategic objectives, the top of the cascade. */
export const campaignStrategy = {
  activeUnit: "active",
  ofTotal: (total: number) => `of ${total}`,
  addAction: "Add objective",
  addFirst: "Add a strategic objective",
  active: "Active",
  paused: "Paused",
  cancel: "Cancel",
  saveObjective: "Save objective",
  editLabel: (title: string) => `Edit ${title}`,
} as const;

/** Objective-planning population scope surface. */
export const campaignPopulation = {
  title: "Population scope",
  description: "Build the employee baseline from Core org structure.",
  scopeRequiredTitle: "Choose the campaign population",
  scopeRequiredCaption:
    "Start with one or more org units. The resolved employee count appears after the scope is saved.",
  reachLabel: "in scope",
  reachEmpty: "No population yet",
  reachUnsaved: "Unsaved",
  saving: "Saving…",
  fromScopes: (count: number) =>
    `${count} ${count === 1 ? "org unit" : "org units"}`,
  excludedChip: (count: number) =>
    `${count} ${count === 1 ? "excluded" : "excluded"}`,
  sourcesLabel: "Sources",
  exceptionsLabel: "Exceptions",
  subUnits: "sub-units",
  addSource: "Add source",
  addException: "Add exception",
  noExceptions: "No exceptions",
  addReason: "Add a reason",
  ofWorkforce: (total: number) => `of ${total.toLocaleString()}`,
  workforceUnit: "employees",
  includeHeading: "Include from your organization",
  includeHint: "Toggle a unit to bring its people into the campaign.",
  treeEmpty: "No published org structure yet.",
  treeLoading: "Loading your organization…",
  removeHeading: "Remove specific people",
  viaAncestor: (name: string) => `via ${name}`,
  includeUnit: (name: string) => `Include ${name}`,
  removeUnit: (name: string) => `Remove ${name}`,
  excludePerson: (name: string) => `Exclude ${name}`,
  reincludePerson: (name: string) => `Put ${name} back`,
  morePeople: (count: number) => `+${count} more — search to exclude`,
  findPerson: "Find someone to remove",
  excludedElsewhere: "Removed by search",
  pendingScope: "Unsaved scope",
  scopeNeeded: "Scope needed",
  previewReady: "Preview ready",
  selectedScopes: (count: number) =>
    `${count} ${count === 1 ? "org unit" : "org units"}`,
  excludedCount: (count: number) =>
    `${count} ${count === 1 ? "exclusion" : "exclusions"}`,
  savedPreviewNote: "Saved population preview",
  dirtyPreviewNote: "Save the population changes to refresh the preview.",
  allActiveTitle: "Population not selected",
  allActiveCaption:
    "No employees are selected until HR chooses an org-unit scope.",
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
  confirmRemove: "Remove from campaign",
  cancel: "Cancel",
  resolvedCount: (count: number) =>
    `${count} ${count === 1 ? "person participates" : "people participate"}`,
  remove: "Remove",
} as const;

/** Launch readiness review surface. */
export const campaignReadinessReview = {
  title: "Launch readiness",
  readyDescription: (count: number) =>
    `${count} ${count === 1 ? "employee is" : "employees are"} in scope with no launch blockers.`,
  blockedDescription: "Finish the required setup work before launch.",
  ready: "Ready to launch",
  notReady: "Not ready yet",
  exceptionsHeading: "Approver exceptions",
  exceptionsCaption: "Only employees needing attention are shown here.",
  noExceptionsTitle: "No approver exceptions",
  noExceptionsCaption:
    "The population has managers or approved overrides for launch.",
  approver: "Approver",
  defaultApprover: "Manager",
  overriddenApprover: "Overridden",
  overrideAction: "Change approver",
  missingApprover: "No approver",
  excludedHeading: "Excluded",
  blockingHeading: "Launch blockers",
  blockingCaption: "Fix these before the baseline can be frozen.",
  blockingAction: "Required before launch",
  blockingMore: (count: number) => `${count} more hidden`,
  missingApproverSummary: (count: number) =>
    `${count} ${count === 1 ? "employee needs" : "employees need"} a review manager.`,
  missingApproverAction: "Assign review managers",
  missingApproversHidden: (shown: number, total: number) =>
    `Showing ${shown} of ${total} missing approvers.`,
  informationalHeading: "Worth a glance",
  overrideReasonLabel: "Why change the approver?",
  overrideReasonPlaceholder: "e.g. Direct manager is on leave",
  overrideApproverLabel: "New approver",
  overrideSubmit: "Set approver",
  overrideSubmitting: "Setting…",
} as const;

/**
 * The launch runway — a spine of setup gates that doubles as the step nav.
 * Four gates lead to the launch pad; wording stays glanceable (one word per
 * station, one word of status), never explanatory.
 */
export const campaignRunway = {
  title: "Launch runway",
  cleared: "Ready",
  remaining: (count: number) => `${count} to go`,
  unsaved: "Unsaved",
  locked: "Clear the gates first",
  status: {
    done: "Ready",
    active: "In progress",
    todo: "To do",
    error: "Needs a fix",
  },
  steps: {
    campaign: { label: "Campaign", hint: "Name, year & purpose" },
    timeline: { label: "Timeline", hint: "Planning dates" },
    strategy: { label: "Strategy", hint: "Strategic objectives" },
    population: { label: "Population", hint: "Who plans" },
    launch: { label: "Launch", hint: "Review & go" },
  },
} as const;

/** The launch pad — the runway's climactic final step. */
export const campaignLaunchPad = {
  eyebrow: "Launch pad",
  frozenUnit: "people",
  frozenUnitOne: "person",
  frozenLead: "frozen into this campaign's baseline",
  coverageTitle: "Review-manager coverage",
  coverageReady: "Everyone has a review manager",
  coverageCovered: (count: number) => `${count} covered`,
  coverageGap: (count: number) =>
    `${count} ${count === 1 ? "person needs" : "people need"} a review manager`,
  coverageResolve: "Assign",
  coverageHide: "Hide",
  holdTitle: "Finish setup to launch",
  holdCount: (count: number) => `${count} to resolve`,
  emptyScopeTitle: "No one in scope yet",
  emptyScopeHint: "Choose a population before you can launch.",
} as const;

/** The launch commit — the earned climactic moment. */
export const campaignLaunch = {
  action: "Launch campaign",
  title: "Launch this campaign?",
  frozenSummary: (count: number) =>
    `${count} ${count === 1 ? "participant" : "participants"} and their approvers will be frozen as this campaign's baseline.`,
  confirm: "Launch now",
  launching: "Launching…",
  cancel: "Not yet",
  success: "Campaign launched",
  launchedTitle: "Launched",
  launchedCaption: (count: number, date: string) =>
    `Baseline frozen with ${count} ${count === 1 ? "participant" : "participants"} on ${date}.`,
  baselineHeading: "Participant baseline",
  baselineEmpty: "No baseline participants.",
  baselineTruncated: (shown: number, total: number) =>
    `Showing the first ${shown} of ${total} participants`,
  assignedPeople: (count: number) =>
    `${count} ${count === 1 ? "person assigned" : "people assigned"}`,
  baselineGrouped: (shownManagers: number, totalManagers: number) =>
    shownManagers < totalManagers
      ? `${shownManagers} of ${totalManagers} review managers shown`
      : `${totalManagers} ${totalManagers === 1 ? "review manager" : "review managers"}`,
  baselineSearchResults: (shown: number, total: number) =>
    `${shown} matching ${shown === 1 ? "person" : "people"} shown from ${total}`,
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
  addFirstAction: "Add a team objective",
  addAnotherAction: "Add another",
  cascadeMeter: (covered: number, total: number) =>
    `${covered}/${total} covered`,
  emptyList: {
    title: "No campaigns waiting for you",
    description:
      "You're not responsible for anyone in a launched campaign yet.",
  },
  openWorkspace: "Open workspace",
  liveTag: "Live",
  planningOpens: (date: string) => `Planning opens ${date}`,
  availabilityNote: (date: string) => `Team sees these ${date}`,
  availabilityNoteOpen: "Live for your team",
  scopeParticipants: (count: number) =>
    `${count} ${count === 1 ? "person" : "people"}`,
  scopeLabel: "in your scope",
  objectivesAuthored: "you've authored",
  objectiveCount: (count: number) =>
    `${count} ${count === 1 ? "objective" : "objectives"}`,
  moreInScope: (count: number) => `+${count} more`,
  successLabel: "Success looks like",
  needsObjective: "Needs a team objective",
} as const;

/** The single create/edit business action for a team objective. */
export const teamObjectiveEditor = {
  createTitle: "Add a team objective",
  editTitle: "Edit team objective",
  strategicLabel: "Strategic objective",
  titleLabel: "Team objective",
  titlePlaceholder: "e.g. Raise client delivery NPS in our accounts",
  successCriteriaLabel: "Success looks like",
  successCriteriaPlaceholder: "e.g. NPS above 60 across our accounts by Q4",
  measurementLabel: "Measured",
  descriptionLabel: "Context for your team (optional)",
  descriptionPlaceholder:
    "Anything your team should know about this objective.",
  submitCreate: "Save team objective",
  submitEdit: "Save changes",
  submitting: "Saving…",
  cancel: "Cancel",
  created: "Team objective saved",
  updated: "Team objective updated",
  conflict:
    "Changed in another session since you opened it. Saving again will replace that version with yours.",
  deleteAction: "Delete",
  deleteTitle: "Delete this team objective?",
  deleteDescription:
    "It will be removed from the campaign cascade. This can't be undone.",
  deleteConfirm: "Delete objective",
  deleteCancel: "Keep objective",
  deleted: "Team objective deleted",
} as const;

/** Direction strategy door + the shared strategy-alignment surface (informational, never blocking). */
export const strategyTerms = {
  navLabel: "Strategy",
  listTitle: "Strategy",
  emptyList: {
    title: "No launched campaigns",
    description: "Campaign strategy appears here once a campaign is launched.",
  },
  coverageTitle: "Strategy alignment",
  viewStrategy: "View strategy",
  launchedOn: (date: string) => `Launched ${date}`,
  coveredNumeralLabel: "strategic goals aligned",
  coveredLegend: "aligned",
  gapLegend: "needs team objective",
  fullyCovered: "Fully covered",
  gapsToClose: (count: number) =>
    `${count} strategic ${count === 1 ? "goal needs" : "goals need"} team objectives`,
  needsObjective: "Needs a team objective",
  successLabel: "Success looks like",
  contributing: (covered: number, total: number) =>
    `${covered}/${total} active`,
  managersContributing: "managers with team objectives",
  teamObjectivesLabel: "team objectives",
  managersHeading: "Managers",
  managerScope: (count: number) =>
    `${count} ${count === 1 ? "participant" : "participants"}`,
  objectiveCount: (count: number) =>
    `${count} ${count === 1 ? "objective" : "objectives"}`,
  moreManagers: (count: number) => `+${count} more`,
  truncatedObjectives: (shown: number, total: number) =>
    `Showing the first ${shown} of ${total} team objectives`,
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
