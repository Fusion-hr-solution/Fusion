import { describe, expect, it } from "vitest";
import { alignmentMapHref, calibrationHref, newReviewRoundHref, objectiveHref, planHref, reviewHref, roundHref, withCycle, peerRequestHref, peerListHref } from "./performance-routes";

describe("canonical objective addresses", () => {
  it("addresses the supplied cycle independently of current workspace state", () => {
    expect(objectiveHref({ cycleId: "past-cycle", objectiveId: "objective" })).toBe("/cycles/past-cycle/objectives/objective");
  });

  it("keeps recording as a mode of the same address", () => {
    expect(objectiveHref({ cycleId: "cycle", objectiveId: "objective" }, "record")).toBe("/cycles/cycle/objectives/objective?mode=record");
  });

  it("encodes identifiers as individual path segments", () => {
    expect(objectiveHref({ cycleId: "cycle/other", objectiveId: "objective?mode=record" })).toBe("/cycles/cycle%2Fother/objectives/objective%3Fmode%3Drecord");
  });
});

describe("other record addresses", () => {
  it("addresses a plan by its own cycle", () => {
    expect(planHref({ cycleId: "fy27", planId: "p1" })).toBe("/cycles/fy27/plans/p1");
  });

  it("addresses reviews, rounds and calibration by their own identity", () => {
    expect(reviewHref("r1")).toBe("/reviews/r1");
    expect(roundHref("round 1")).toBe("/reviews/rounds/round%201");
    expect(peerRequestHref("p 1")).toBe("/reviews/peer-requests/p%201");
    expect(peerListHref("r1")).toBe("/reviews?peers=r1");
    expect(newReviewRoundHref()).toBe("/reviews/rounds/new");
    expect(calibrationHref("round1")).toBe("/reviews/rounds/round1/calibration");
  });
});

describe("workspace cycle context", () => {
  it("adds the selected cycle while keeping existing parameters", () => {
    expect(withCycle("/team?filter=review", "fy26")).toBe("/team?filter=review&cycle=fy26");
    expect(withCycle("/plan", "fy26")).toBe("/plan?cycle=fy26");
  });

  it("leaves addresses unchanged without a cycle or when the record already carries one", () => {
    expect(withCycle("/plan", null)).toBe("/plan");
    expect(withCycle("/cycles/fy26/plans/p1", "fy27")).toBe("/cycles/fy26/plans/p1");
  });
});

describe("alignment map address", () => {
  it("opens the map of a cycle, focused when asked", () => {
    expect(alignmentMapHref("c-1")).toBe("/goals?view=map&cycle=c-1");
    expect(alignmentMapHref("c-1", "o-1")).toBe("/goals?view=map&cycle=c-1&focus=o-1");
    expect(alignmentMapHref("c-1", "mine", "parent")).toBe("/goals?view=map&cycle=c-1&focus=mine&near=parent");
  });
});
