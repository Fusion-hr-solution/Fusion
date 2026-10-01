import { describe, expect, it } from "vitest";
import { niceStep, numericDomain, percentDomain } from "./value-dial-lib";

describe("niceStep", () => {
  it("rounds up to 1/2/2.5/5 × 10^k", () => {
    expect(niceStep(0.04)).toBe(0.05);
    expect(niceStep(0.28)).toBe(0.5);
    expect(niceStep(3)).toBe(5);
    expect(niceStep(10)).toBe(10);
  });
});

describe("percentDomain", () => {
  it("is whole percents 0..100", () => {
    const d = percentDomain();
    expect(d.max).toBe(100);
    expect(d.positionOf(65.4)).toBe(65);
    expect(d.positionOf(140)).toBe(100);
  });
});

describe("numericDomain", () => {
  it("returns null for a degenerate scale", () => {
    expect(numericDomain(5, 5, "days", null)).toBeNull();
  });

  it("runs a decreasing target left→right and never below zero", () => {
    const d = numericDomain(5, 1, "business days", null)!;
    expect(d.step).toBe(0.5);
    expect(d.valueAt(d.baselinePos)).toBe(5);
    expect(d.valueAt(d.targetPos!)).toBe(1);
    expect(d.valueAt(d.max)).toBe(0); // overachievement run stops at the zero floor
    expect(d.targetPos!).toBeGreaterThan(d.baselinePos);
  });

  it("adds an overachievement run past an increasing target", () => {
    const d = numericDomain(42, 70, null, null)!;
    expect(d.valueAt(d.baselinePos)).toBe(42);
    expect(d.valueAt(d.targetPos!)).toBe(70);
    expect(d.valueAt(d.max)).toBeGreaterThan(70);
  });

  it("caps a % unit at 100", () => {
    const d = numericDomain(42, 95, "%", null)!;
    expect(d.valueAt(d.max)).toBeLessThanOrEqual(100);
  });

  it("widens to include a reported value behind the baseline or past the run", () => {
    const behind = numericDomain(10, 20, null, 4)!;
    expect(behind.valueAt(0)).toBeLessThanOrEqual(4);
    expect(behind.valueAt(behind.positionOf(4))).toBe(4);
    const beyond = numericDomain(10, 20, null, 60)!;
    expect(beyond.valueAt(beyond.positionOf(60))).toBe(60);
  });

  it("uses fine steps for decimal scales without float noise", () => {
    const d = numericDomain(0.5, 1.2, null, null)!;
    expect(d.step).toBe(0.01);
    for (let p = 0; p <= d.max; p++) {
      const v = d.valueAt(p);
      expect(String(v).split(".")[1]?.length ?? 0).toBeLessThanOrEqual(2);
    }
  });
});
