import { describe, expect, it } from "vitest";
import type { OverviewSectionDto } from "@repo/api";
import { arrangeOverview, overviewHref } from "./overview-model";

const cycleId = "c-1";
const destination = { workspace: "Team" as const, cycleId };
const planning: OverviewSectionDto = {
  kind: "teamPlanning",
  people: 6,
  awaitingDecision: 1,
  notStarted: 1,
  draft: 1,
  returned: 1,
  submitted: 1,
  approved: 2,
  destination,
};
const execution: OverviewSectionDto = {
  kind: "teamExecution",
  approved: 2,
  approvedReporting: 1,
  peopleWithOverdue: 1,
  peopleWithoutRecentUpdate: 0,
  destination,
};
const none: OverviewSectionDto = { kind: "noCycle", create: null };

describe("overviewHref", () => {
  it("keeps the section's Cycle on workspace destinations", () => {
    expect(overviewHref({ workspace: "MyPlan", cycleId })).toBe("/plan?cycle=c-1");
    expect(overviewHref({ workspace: "TeamNeedsReview", cycleId })).toBe("/team?view=needs-review&cycle=c-1");
    expect(overviewHref({ workspace: "OrganizationDirection", cycleId })).toBe("/goals?cycle=c-1");
    expect(overviewHref({ workspace: "CycleAdmin", cycleId })).toBe("/cycle?cycle=c-1");
  });

  it("addresses records by their own identity", () => {
    expect(overviewHref({ workspace: "Plan", cycleId, planId: "p-1" })).toBe("/cycles/c-1/plans/p-1");
    expect(overviewHref({ workspace: "Objective", cycleId, objectiveId: "o-1" })).toBe("/cycles/c-1/objectives/o-1");
  });

  it("sends Cycle creation and setup to the setup flow", () => {
    expect(overviewHref({ workspace: "CycleCreate", cycleId: null })).toBe("/cycle/setup/details");
    expect(overviewHref({ workspace: "CycleSetup", cycleId })).toBe("/cycle/setup?cycle=c-1");
  });

  it("routes review work to Reviews and operations to their round", () => {
    expect(overviewHref({ workspace: "Reviews", cycleId })).toBe("/reviews?cycle=c-1");
    expect(overviewHref({ workspace: "ReviewRound", cycleId, reviewRoundId: "r-1" })).toBe("/reviews/rounds/r-1?cycle=c-1");
    expect(overviewHref({ workspace: "Calibration", cycleId, reviewRoundId: "r-1" })).toBe("/reviews/rounds/r-1/calibration?cycle=c-1");
  });
});

describe("arrangeOverview", () => {
  it("reads team planning and execution as one team block in server order", () => {
    const blocks = arrangeOverview([planning, execution, none]);
    expect(blocks.map((b) => b.kind)).toEqual(["team", "noCycle"]);
    expect(blocks[0]).toMatchObject({ kind: "team", planning, execution });
  });

  it("keeps a team block without execution before any plan is approved", () => {
    expect(arrangeOverview([planning])).toEqual([{ kind: "team", planning, execution: undefined }]);
  });

  it("passes every other section through unchanged", () => {
    expect(arrangeOverview([none])).toEqual([none]);
  });
});
