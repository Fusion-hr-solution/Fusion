import { describe, expect, it } from "vitest";
import { calibrationHref, newReviewRoundHref, objectiveHref, planHref, reviewHref, roundHref, roundSetupHref, withCycle } from "./performance-routes";

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
    expect(roundSetupHref("round 1", "details")).toBe("/reviews/rounds/round%201/setup/details");
    expect(roundSetupHref("round 1", "population")).toBe("/reviews/rounds/round%201/setup/population");
    expect(roundSetupHref("round 1", "review")).toBe("/reviews/rounds/round%201/setup/review");
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
