import type { TeamRosterMemberDto } from "@repo/api";
import { english, type Say } from "@/i18n/say";

type ActivitySource = Pick<TeamRosterMemberDto, "activityKind" | "activityAt" | "updateRequest">;

const en = english("team.activity");

export interface RosterActivity {
  label: string;
  at: string;
  objectiveTitle: string | null;
}

/** The roster has one latest event, including update requests beside plan and progress events. */
export function latestRosterActivity(member: ActivitySource, say: Say = en): RosterActivity | null {
  const label = member.activityKind === "None" ? null : say(member.activityKind);
  const planActivity = label && member.activityAt
    ? { label, at: member.activityAt, objectiveTitle: null }
    : null;

  const request = member.updateRequest;
  const requestActivity = request?.state === "Open"
    ? { label: say("requested"), at: request.requestedAt, objectiveTitle: request.objectiveTitle }
    : request?.state === "Satisfied" && request.satisfiedAt
      ? { label: say("received"), at: request.satisfiedAt, objectiveTitle: request.objectiveTitle }
      : null;

  if (!requestActivity) return planActivity;
  if (!planActivity) return requestActivity;
  return Date.parse(requestActivity.at) > Date.parse(planActivity.at) ? requestActivity : planActivity;
}
