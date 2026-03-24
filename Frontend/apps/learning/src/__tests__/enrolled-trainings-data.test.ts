import { describe, it, expect } from "vitest";
import { MOCK_ENROLLED_TRAININGS } from "@/data/enrolled-trainings";

describe("Enrolled trainings data integrity", () => {
  it("every enrolled training has isMandatory, badgeLevel, credits", () => {
    for (const t of MOCK_ENROLLED_TRAININGS) {
      expect(typeof t.isMandatory).toBe("boolean");
      expect(["bronze", "silver", "gold"]).toContain(t.badgeLevel);
      expect(t.credits).toBeGreaterThan(0);
    }
  });

  it("every enrolled training has a valid status", () => {
    for (const t of MOCK_ENROLLED_TRAININGS) {
      expect(["in-progress", "completed", "not-started"]).toContain(t.status);
    }
  });

  it("completed trainings have 100% progress", () => {
    const completed = MOCK_ENROLLED_TRAININGS.filter((t) => t.status === "completed");
    for (const t of completed) {
      expect(t.progress).toBe(100);
    }
  });

  it("not-started trainings have 0% progress", () => {
    const notStarted = MOCK_ENROLLED_TRAININGS.filter((t) => t.status === "not-started");
    for (const t of notStarted) {
      expect(t.progress).toBe(0);
    }
  });

  it("in-progress trainings have progress between 1 and 99", () => {
    const inProgress = MOCK_ENROLLED_TRAININGS.filter((t) => t.status === "in-progress");
    for (const t of inProgress) {
      expect(t.progress).toBeGreaterThan(0);
      expect(t.progress).toBeLessThan(100);
    }
  });
});
