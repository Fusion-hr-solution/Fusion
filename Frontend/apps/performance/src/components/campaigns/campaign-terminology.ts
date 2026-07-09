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

export function campaignStatusLabel(status: string): string {
  return status === "Draft" ? "Draft" : status;
}
