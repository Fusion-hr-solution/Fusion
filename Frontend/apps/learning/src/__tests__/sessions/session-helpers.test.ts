import { describe, it, expect } from "vitest";
import {
  capacityRatio,
  isCapacityWarning,
  isOverlapping,
  durationHoursBetween,
  formatSessionTimeRange,
} from "@/lib/session-helpers";

describe("session-helpers", () => {
  describe("capacityRatio", () => {
    it("returns 0 when max is 0", () => {
      expect(capacityRatio(5, 0)).toBe(0);
    });
    it("computes ratio correctly", () => {
      expect(capacityRatio(15, 20)).toBeCloseTo(0.75);
    });
  });

  describe("isCapacityWarning", () => {
    it("warns at 90% capacity", () => {
      expect(isCapacityWarning(9, 10)).toBe(true);
      expect(isCapacityWarning(18, 20)).toBe(true);
    });
    it("does not warn below 90%", () => {
      expect(isCapacityWarning(8, 10)).toBe(false);
      expect(isCapacityWarning(17, 20)).toBe(false);
    });
  });

  describe("isOverlapping", () => {
    it("detects overlap", () => {
      expect(isOverlapping(
        "2025-04-10T09:00:00Z", "2025-04-10T12:00:00Z",
        "2025-04-10T10:00:00Z", "2025-04-10T11:00:00Z",
      )).toBe(true);
    });
    it("returns false for adjacent times", () => {
      expect(isOverlapping(
        "2025-04-10T09:00:00Z", "2025-04-10T12:00:00Z",
        "2025-04-10T12:00:00Z", "2025-04-10T13:00:00Z",
      )).toBe(false);
    });
    it("returns false for disjoint times", () => {
      expect(isOverlapping(
        "2025-04-10T09:00:00Z", "2025-04-10T10:00:00Z",
        "2025-04-10T11:00:00Z", "2025-04-10T12:00:00Z",
      )).toBe(false);
    });
  });

  describe("durationHoursBetween", () => {
    it("computes positive duration", () => {
      expect(durationHoursBetween("2025-04-10T09:00:00Z", "2025-04-10T12:00:00Z")).toBe(3);
    });
    it("clamps negative duration to 0", () => {
      expect(durationHoursBetween("2025-04-10T12:00:00Z", "2025-04-10T09:00:00Z")).toBe(0);
    });
  });

  describe("formatSessionTimeRange", () => {
    it("returns a non-empty string with a separator", () => {
      const out = formatSessionTimeRange("2025-04-10T09:00:00Z", "2025-04-10T12:00:00Z");
      expect(out).toContain("–");
    });
  });
});
