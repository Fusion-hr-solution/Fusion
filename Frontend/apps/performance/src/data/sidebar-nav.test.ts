import { describe, expect, it } from "vitest";
import type { WorkspaceDestinationsDto } from "@repo/api";
import { visiblePrimaryItems } from "./sidebar-nav";

const none: WorkspaceDestinationsDto = {
  overview: true, myPlan: false, team: false, reviews: false, cycleAdmin: false, settings: false, oneOnOnes: false, feedback: false,
};

describe("primary navigation", () => {
  it("shows 1:1s and Feedback only when the workspace offers them, after My Plan and Team", () => {
    expect(visiblePrimaryItems(none).map((i) => i.label)).toEqual(["Overview"]);
    const manager = visiblePrimaryItems({ ...none, myPlan: true, team: true, oneOnOnes: true, feedback: true, reviews: true });
    expect(manager.map((i) => i.label)).toEqual(["Overview", "My Plan", "Team Performance", "1:1s", "Feedback", "Reviews"]);
  });

  it("keeps Feedback without 1:1s for someone with no manager and no reports", () => {
    expect(visiblePrimaryItems({ ...none, feedback: true }).map((i) => i.label)).toEqual(["Overview", "Feedback"]);
  });

  it("shows nothing but Overview before the context loads", () => {
    expect(visiblePrimaryItems(undefined).map((i) => i.label)).toEqual(["Overview"]);
  });
});
