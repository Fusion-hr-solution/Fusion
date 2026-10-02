import { describe, expect, it } from "vitest";
import type { CycleSummaryDto } from "@repo/api";
import { resolveOverview, selectOverviewCycles, type OverviewContext } from "./overview-model";

function cycle(id: string, state: CycleSummaryDto["state"], startDate: string, endDate: string): CycleSummaryDto {
  return { id, name: id, description: null, startDate, endDate, planningDeadline: startDate, state, activatedAt: null };
}

const active = cycle("fy27", "Active", "2026-08-01", "2027-07-31");
const draft = cycle("fy28", "Draft", "2027-08-01", "2028-07-31");
const closed = cycle("fy26", "Closed", "2025-08-01", "2026-07-31");

const nothing = {
  canParticipate: false,
  canLeadTeam: false,
  canManageTeamObjectives: false,
  canViewOrgDirection: false,
  canAdminister: false,
};

function context(overrides: Partial<OverviewContext>): OverviewContext {
  return { ...nothing, cycles: { active, draft: null, latestClosed: null }, ...overrides };
}

describe("resolveOverview", () => {
  it("gives a participant their own plan and nothing they are not responsible for", () => {
    expect(resolveOverview(context({ canParticipate: true }))).toEqual(["my-plan"]);
  });

  it("composes sections independently — a participant who leads a team and administers gets the union", () => {
    const everything = resolveOverview(
      context({
        canParticipate: true,
        canLeadTeam: true,
        canManageTeamObjectives: true,
        canViewOrgDirection: true,
        canAdminister: true,
        cycles: { active, draft, latestClosed: closed },
      })
    );
    expect(everything).toEqual([
      "my-plan",
      "team-attention",
      "team-objective",
      "planning-operation",
      "org-direction",
      "setup",
    ]);

    // Each capability contributes only its own sections.
    const lead = resolveOverview(context({ canLeadTeam: true }));
    const admin = resolveOverview(context({ canAdminister: true, canViewOrgDirection: true }));
    expect(lead).toEqual(["team-attention"]);
    expect(admin).toEqual(["planning-operation", "org-direction"]);
  });

  it("never gives an administration account without a workforce record a team or a plan", () => {
    // canLeadTeam requires a workforce link, so it is false here regardless of grants.
    expect(resolveOverview(context({ canAdminister: true, canViewOrgDirection: true, canParticipate: false }))).not.toContain(
      "team-attention"
    );
  });

  it("shows an unfinished cycle only to administration", () => {
    const setup = { active: null, draft, latestClosed: null };
    expect(resolveOverview(context({ canAdminister: true, cycles: setup }))).toEqual(["setup"]);
    expect(resolveOverview(context({ canParticipate: true, canLeadTeam: true, cycles: setup }))).toEqual(["no-cycle"]);
  });

  it("acknowledges the cycle that just closed instead of going blank", () => {
    const after = { active: null, draft, latestClosed: closed };
    expect(resolveOverview(context({ canParticipate: true, cycles: after }))).toEqual(["closed-cycle"]);
    expect(resolveOverview(context({ canAdminister: true, cycles: after }))).toEqual(["setup", "closed-cycle"]);
  });

  it("is never empty", () => {
    const none = { active: null, draft: null, latestClosed: null };
    expect(resolveOverview(context({ cycles: none }))).toEqual(["no-cycle"]);
    expect(resolveOverview(context({ canAdminister: true, cycles: none }))).toEqual(["no-cycle"]);
    // Someone with no section of a running cycle still learns its state.
    expect(resolveOverview(context({}))).toEqual(["cycle-status"]);
  });
});

describe("selectOverviewCycles", () => {
  it("keeps the latest of each state so a new draft never hides the closed cycle", () => {
    const older = cycle("fy25", "Closed", "2024-08-01", "2025-07-31");
    expect(selectOverviewCycles([draft, older, closed, active])).toEqual({ active, draft, latestClosed: closed });
  });
});
