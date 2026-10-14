import type { TeamRosterMemberDto } from "@repo/api";

type ActivitySource = Pick<TeamRosterMemberDto, "activityKind" | "activityAt" | "updateRequest">;

const ACTIVITY_LABEL: Record<TeamRosterMemberDto["activityKind"], string | null> = {
  None: null,
  DraftUpdated: "Draft updated",
  Returned: "Returned for changes",
  Submitted: "Plan submitted",
  Resubmitted: "Resubmitted",
  Approved: "Plan approved",
  ProgressUpdated: "Progress updated",
};

export interface RosterActivity {
  label: string;
  at: string;
  objectiveTitle: string | null;
}

/** The roster has one latest event, including update requests beside plan and progress events. */
export function latestRosterActivity(member: ActivitySource): RosterActivity | null {
  const label = ACTIVITY_LABEL[member.activityKind];
  const planActivity = label && member.activityAt
    ? { label, at: member.activityAt, objectiveTitle: null }
    : null;

  const request = member.updateRequest;
  const requestActivity = request?.state === "Open"
    ? { label: "Update requested", at: request.requestedAt, objectiveTitle: request.objectiveTitle }
    : request?.state === "Satisfied" && request.satisfiedAt
      ? { label: "Update received", at: request.satisfiedAt, objectiveTitle: request.objectiveTitle }
      : null;

  if (!requestActivity) return planActivity;
  if (!planActivity) return requestActivity;
  return Date.parse(requestActivity.at) > Date.parse(planActivity.at) ? requestActivity : planActivity;
}
