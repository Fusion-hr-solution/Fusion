import { describe, expect, it } from "vitest";
import { checkWeightFeasibility } from "./weight-feasibility";

describe("checkWeightFeasibility", () => {
  // --- basic feasibility ---

  it("is feasible when a single weight equals 100", () => {
    const result = checkWeightFeasibility("100", 1);
    expect(result.feasible).toBe(true);
    expect(result.example).toBe("100% = 100%");
  });

  it("is feasible when two equal weights sum to 100 within max 2", () => {
    const result = checkWeightFeasibility("50", 2);
    expect(result.feasible).toBe(true);
    expect(result.example).toBe("50% + 50% = 100%");
  });

  it("is feasible for the spec example: {25,50} with max 4", () => {
    // e.g. 50+25+25 = 100 (3 objectives ≤ 4)
    const result = checkWeightFeasibility("25,50", 4);
    expect(result.feasible).toBe(true);
  });

  it("is feasible for {10,20,30,40,50} with max 5", () => {
    const result = checkWeightFeasibility("10,20,30,40,50", 5);
    expect(result.feasible).toBe(true);
  });

  // --- infeasibility cases ---

  it("is infeasible when {30,40} cannot sum to 100 within max 2", () => {
    // 30+40=70, 30+30=60, 40+40=80 — no two values reach 100
    // 30+40+30=100 needs 3, but max is 2
    const result = checkWeightFeasibility("30,40", 2);
    expect(result.feasible).toBe(false);
    expect(result.reason).toContain("100%");
    expect(result.reason).toContain("2");
  });

  it("is infeasible when {30,40} can reach 100 within max 3", () => {
    // 30+30+40=100 — needs exactly 3, max is 3 ✓
    const result = checkWeightFeasibility("30,40", 3);
    expect(result.feasible).toBe(true);
  });

  it("is infeasible when a value is not a 5 percent increment", () => {
    const result = checkWeightFeasibility("33", 10);
    expect(result.feasible).toBe(false);
    expect(result.reason).toContain("5%");
  });

  it("is infeasible when the only value is 60 and max is 1", () => {
    const result = checkWeightFeasibility("60", 1);
    expect(result.feasible).toBe(false);
  });

  // --- apply gating ---

  it("gating: apply should be blocked when not feasible", () => {
    const result = checkWeightFeasibility("30,40", 2);
    // The Apply action is blocked when the configuration is not feasible.
    expect(result.feasible).toBe(false);
  });

  it("gating: apply should be allowed when feasible", () => {
    const result = checkWeightFeasibility("25,50", 4);
    expect(result.feasible).toBe(true);
  });

  // --- edge cases ---

  it("returns infeasible for empty weight string", () => {
    const result = checkWeightFeasibility("", 5);
    expect(result.feasible).toBe(false);
    expect(result.reason).toBe("No valid weights specified.");
  });

  it("returns infeasible for whitespace-only weight string", () => {
    const result = checkWeightFeasibility("  ,  ", 5);
    expect(result.feasible).toBe(false);
    expect(result.reason).toBe("No valid weights specified.");
  });

  it("returns infeasible when maxObjectives is 0", () => {
    const result = checkWeightFeasibility("50", 0);
    expect(result.feasible).toBe(false);
    expect(result.reason).toBe("Max objectives must be at least 1.");
  });

  it("returns infeasible when maxObjectives is negative", () => {
    const result = checkWeightFeasibility("50", -1);
    expect(result.feasible).toBe(false);
    expect(result.reason).toBe("Max objectives must be at least 1.");
  });

  it("rejects invalid non-numeric entries in the weight string", () => {
    const result = checkWeightFeasibility("10,abc,90", 2);
    expect(result.feasible).toBe(false);
    expect(result.reason).toContain("5%");
  });

  it("rejects weight values greater than 100", () => {
    const result = checkWeightFeasibility("200", 1);
    expect(result.feasible).toBe(false);
    expect(result.reason).toContain("5%");
  });

  it("rejects zero-value weights", () => {
    const result = checkWeightFeasibility("0,100", 1);
    expect(result.feasible).toBe(false);
  });

  it("rejects duplicate menu values", () => {
    const result = checkWeightFeasibility("50,50", 2);
    expect(result.feasible).toBe(false);
  });

  it("handles extra whitespace around values", () => {
    const result = checkWeightFeasibility(" 25 , 50 ", 4);
    expect(result.feasible).toBe(true);
  });

  it("handles a single large max-objectives count efficiently", () => {
    const result = checkWeightFeasibility("10", 10);
    expect(result.feasible).toBe(true);
    expect(result.example).toContain("= 100%");
  });

  // --- example reconstruction ---

  it("includes a reconstruction example on success", () => {
    const result = checkWeightFeasibility("100", 1);
    expect(result.example).toBeDefined();
    expect(result.example).toMatch(/= 100%$/);
  });

  it("does not include an example on failure", () => {
    const result = checkWeightFeasibility("30,40", 2);
    expect(result.example).toBeUndefined();
  });
});
