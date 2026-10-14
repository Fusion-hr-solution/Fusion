import { describe, expect, it } from "vitest";
import { reviewStageLabel } from "./review-stage";

describe("Your People review stage labels", () => {
  it.each([
    ["SelfAssessment", "Self-assessment"],
    ["ManagerAssessment", "Reviewer assessment"],
    ["Calibration", "Calibration"],
    ["ReadyToFinalize", "Ready to finalize"],
    ["Finalized", "Finalized"],
    ["Closed", "Closed"],
  ] as const)("maps %s to the human stage name", (state, label) => {
    expect(reviewStageLabel(state)).toBe(label);
  });
});
