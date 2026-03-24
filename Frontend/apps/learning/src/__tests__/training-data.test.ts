import { describe, it, expect } from "vitest";
import { MOCK_TRAININGS } from "@/data/trainings";
import { BADGE_LEVEL_CONFIG } from "@/data/badge-config";
import { CATEGORY_CONFIG, LEVEL_CONFIG } from "@/data/categories";
import type { BadgeLevel } from "@/types";

describe("Training data integrity", () => {
  it("every mock training has required fields (isMandatory, badgeLevel, credits)", () => {
    for (const t of MOCK_TRAININGS) {
      expect(typeof t.isMandatory).toBe("boolean");
      expect(["bronze", "silver", "gold"]).toContain(t.badgeLevel);
      expect(t.credits).toBeGreaterThan(0);
    }
  });

  it("at least one training is mandatory", () => {
    const mandatory = MOCK_TRAININGS.filter((t) => t.isMandatory);
    expect(mandatory.length).toBeGreaterThan(0);
  });

  it("at least one training is optional", () => {
    const optional = MOCK_TRAININGS.filter((t) => !t.isMandatory);
    expect(optional.length).toBeGreaterThan(0);
  });

  it("has all three badge levels across trainings", () => {
    const levels = new Set(MOCK_TRAININGS.map((t) => t.badgeLevel));
    expect(levels.has("bronze")).toBe(true);
    expect(levels.has("silver")).toBe(true);
    expect(levels.has("gold")).toBe(true);
  });

  it("every training category is in CATEGORY_CONFIG", () => {
    for (const t of MOCK_TRAININGS) {
      expect(CATEGORY_CONFIG).toHaveProperty(t.category);
    }
  });

  it("every training level is in LEVEL_CONFIG", () => {
    for (const t of MOCK_TRAININGS) {
      expect(LEVEL_CONFIG).toHaveProperty(t.level);
    }
  });

  it("every training badgeLevel is in BADGE_LEVEL_CONFIG", () => {
    for (const t of MOCK_TRAININGS) {
      expect(BADGE_LEVEL_CONFIG).toHaveProperty(t.badgeLevel);
    }
  });

  it("trainings with exam have valid exam data", () => {
    const withExam = MOCK_TRAININGS.filter((t) => t.exam);
    expect(withExam.length).toBeGreaterThan(0);

    for (const t of withExam) {
      expect(t.exam!.questionsCount).toBeGreaterThan(0);
      expect(t.exam!.passingScore).toBeGreaterThan(0);
      expect(t.exam!.passingScore).toBeLessThanOrEqual(100);
      expect(t.exam!.maxAttempts).toBeGreaterThan(0);
    }
  });

  it("some trainings have no exam", () => {
    const withoutExam = MOCK_TRAININGS.filter((t) => !t.exam);
    expect(withoutExam.length).toBeGreaterThan(0);
  });

  it("chaptersCount matches chapters array length", () => {
    for (const t of MOCK_TRAININGS) {
      expect(t.chaptersCount).toBe(t.chapters.length);
    }
  });
});

describe("BADGE_LEVEL_CONFIG", () => {
  const levels: BadgeLevel[] = ["bronze", "silver", "gold"];

  it("has entries for all three badge levels", () => {
    for (const level of levels) {
      expect(BADGE_LEVEL_CONFIG[level]).toBeDefined();
      expect(BADGE_LEVEL_CONFIG[level].label).toBeTruthy();
      expect(BADGE_LEVEL_CONFIG[level].className).toBeTruthy();
    }
  });
});
