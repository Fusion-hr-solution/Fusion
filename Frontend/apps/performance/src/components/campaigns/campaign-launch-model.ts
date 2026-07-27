import { ApiError } from "@repo/api";
import type {
  CycleParticipantDto,
  PerformanceCycleDetailDto,
  PopulationRuleInput,
  SetCyclePopulationRequest,
} from "@repo/api";

export type OrgScope = { orgUnitId: string; includeDescendants: boolean };
export type Exclusion = { employeeId: string; name: string | null; reason: string; orgUnitId: string | null };
export type ApproverGroup = { approverName: string; count: number };

export function groupParticipantsByApprover(participants: CycleParticipantDto[]): ApproverGroup[] {
  const groups = new Map<string, CycleParticipantDto[]>();
  for (const participant of participants) {
    const key = participant.approverName || "No approver";
    groups.set(key, [...(groups.get(key) ?? []), participant]);
  }
  return Array.from(groups.entries()).map(([approverName, members]) => ({ approverName, count: members.length }))
    .sort((a, b) => b.count - a.count || a.approverName.localeCompare(b.approverName));
}

export function fromRulesScopes(campaign: PerformanceCycleDetailDto): OrgScope[] {
  return campaign.populationRules.filter((rule) => rule.ruleType === "OrgUnit").map((rule) => ({ orgUnitId: rule.refId, includeDescendants: rule.includeDescendants }));
}

export function fromRulesExclusions(campaign: PerformanceCycleDetailDto): Exclusion[] {
  return campaign.populationRules.filter((rule) => rule.ruleType === "ExcludeEmployee").map((rule) => ({ employeeId: rule.refId, name: null, reason: rule.reason ?? "", orgUnitId: null }));
}

export function toPopulationRequest(scopes: OrgScope[], exclusions: Exclusion[]): SetCyclePopulationRequest {
  const rules: PopulationRuleInput[] = [
    ...scopes.map((scope) => ({ ruleType: "OrgUnit" as const, refId: scope.orgUnitId, includeDescendants: scope.includeDescendants })),
    ...exclusions.map((exclusion) => ({ ruleType: "ExcludeEmployee" as const, refId: exclusion.employeeId, reason: exclusion.reason.trim() })),
  ];
  return { populationIncludeInactive: false, rules };
}

export function serialize(scopes: OrgScope[], exclusions: Exclusion[]): string {
  return JSON.stringify({
    scopes: [...scopes].sort((a, b) => a.orgUnitId.localeCompare(b.orgUnitId)),
    exclusions: [...exclusions].map((exclusion) => ({ employeeId: exclusion.employeeId, reason: exclusion.reason.trim() })).sort((a, b) => a.employeeId.localeCompare(b.employeeId)),
  });
}

export function messageFor(error: Error): string {
  if (error instanceof ApiError) {
    if (error.status === 409) return "This campaign changed. Review the latest values and try again.";
    if (error.status === 403) return "You do not have permission for this action.";
    return error.errors.length > 0 ? error.errors.join(" ") : error.message;
  }
  return error.message;
}
