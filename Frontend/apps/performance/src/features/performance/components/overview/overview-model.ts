import type { CycleSummaryDto, EmployeePlanDto, TeamRosterDto } from "@repo/api";

/**
 * Overview is an attention-and-resume surface. It answers three questions only — what state Performance
 * is in, what needs me, and where to go next — and every section ends in a workspace or an objective
 * record. It never carries a roster table, an objective tree, a review form, goal authoring, or an
 * analytics dashboard: those belong to the workspaces it points to.
 *
 * Sections compose from capabilities and cycle state alone. There is no persona switch: an account that
 * participates, leads a team and administers simply gets every section that applies to it.
 */
export type OverviewSectionId =
  | "my-plan"
  | "team-attention"
  | "team-objective"
  | "planning-operation"
  | "org-direction"
  | "setup"
  | "closed-cycle"
  | "no-cycle"
  | "cycle-status";

/** The cycles Overview speaks about: the running one, one being set up, and the most recently closed. */
export type OverviewCycles = {
  active: CycleSummaryDto | null;
  draft: CycleSummaryDto | null;
  latestClosed: CycleSummaryDto | null;
};

export type OverviewContext = {
  cycles: OverviewCycles;
  canParticipate: boolean;
  canLeadTeam: boolean;
  /** Can read their own team's objective workspace (organizational-objective grant or administration). */
  canManageTeamObjectives: boolean;
  canViewOrgDirection: boolean;
  canAdminister: boolean;
};

type SectionDef = { id: OverviewSectionId; applies: (context: OverviewContext) => boolean };

// Reading order: one's own work, the people one is responsible for, then the organization, then what
// comes next. Each section is gated independently — never by which "kind of user" this is.
const SECTIONS: readonly SectionDef[] = [
  { id: "my-plan", applies: (c) => c.canParticipate && c.cycles.active !== null },
  { id: "team-attention", applies: (c) => c.canLeadTeam && c.cycles.active !== null },
  {
    id: "team-objective",
    applies: (c) => c.canLeadTeam && c.canManageTeamObjectives && c.cycles.active !== null,
  },
  { id: "planning-operation", applies: (c) => c.canAdminister && c.cycles.active !== null },
  { id: "org-direction", applies: (c) => c.canViewOrgDirection && c.cycles.active !== null },
  { id: "setup", applies: (c) => c.canAdminister && c.cycles.draft !== null },
  { id: "closed-cycle", applies: (c) => c.cycles.active === null && c.cycles.latestClosed !== null },
  {
    id: "no-cycle",
    applies: (c) =>
      c.cycles.active === null && c.cycles.latestClosed === null && !(c.canAdminister && c.cycles.draft !== null),
  },
];

export function resolveOverview(context: OverviewContext): OverviewSectionId[] {
  const sections = SECTIONS.filter((section) => section.applies(context)).map((section) => section.id);
  // Someone who may enter Performance but owns no section of a running cycle still learns its state.
  return sections.length > 0 ? sections : ["cycle-status"];
}

/**
 * Splits the tenant's cycles into what Overview speaks about. A Draft is someone's unfinished setup,
 * so it is surfaced only to administration (by the resolver); a new Draft never hides the cycle that
 * just closed.
 */
export function selectOverviewCycles(cycles: CycleSummaryDto[]): OverviewCycles {
  const latest = (state: CycleSummaryDto["state"], by: "startDate" | "endDate") =>
    cycles
      .filter((cycle) => cycle.state === state)
      .sort((a, b) => b[by].localeCompare(a[by]))[0] ?? null;
  return {
    active: latest("Active", "startDate"),
    draft: latest("Draft", "startDate"),
    latestClosed: latest("Closed", "endDate"),
  };
}

/** Where one's own approved plan stands in execution — facts only, never a score. */
export function planExecution(plan: EmployeePlanDto, today: string) {
  const objectives = plan.objectives;
  const reporting = objectives.filter((objective) => objective.hasProgress).length;
  const overdueMilestones = objectives
    .flatMap((objective) => (objective.measurement?.method === "WeightedMilestones" ? objective.measurement.milestones : []))
    .filter((milestone) => !milestone.isCompleted && milestone.dueDate !== null && milestone.dueDate.slice(0, 10) < today).length;
  return { objectiveCount: objectives.length, reporting, notReporting: objectives.length - reporting, overdueMilestones };
}

/** What a people leader's team needs from them, from the roster they already own. */
export function teamAttention(roster: TeamRosterDto) {
  const members = roster.members;
  return {
    people: members.length,
    awaitingDecision: roster.needsReviewCount,
    notStarted: members.filter((member) => member.status === "NotStarted").length,
    returned: members.filter((member) => member.status === "ReturnedForChanges").length,
    approved: members.filter((member) => member.status === "Approved").length,
    approvedNotReporting: members.filter((member) => member.status === "Approved" && !member.hasProgress).length,
    withOverdue: members.filter((member) => member.overdueMilestoneCount > 0).length,
  };
}

/** The local calendar date as YYYY-MM-DD, for comparing against due dates. */
export function localToday(now = new Date()): string {
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

/**
 * The phase a running cycle is in, stated as fact: planning until its deadline, then execution until the
 * cycle ends. Overview leads with it so everyone knows where Performance stands before what needs them.
 */
export function cyclePhase(cycle: CycleSummaryDto, today: string): { planningOpen: boolean; label: string } {
  const planningOpen = cycle.planningDeadline.slice(0, 10) >= today;
  return { planningOpen, label: planningOpen ? "Planning" : "Execution" };
}
