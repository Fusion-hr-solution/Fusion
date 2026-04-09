import { describe, it, expect } from "vitest";
import type { Training, BadgeLevel, TrainingCategory, TrainingLevel, ChapterLayout } from "@/types";

/** Factory to create a minimal valid Training for tests */
function makeTraining(overrides: Partial<Training> = {}): Training {
  return {
    id: "test-1",
    title: "Test Training",
    description: "A test training description",
    category: "technical" as TrainingCategory,
    level: "beginner" as TrainingLevel,
    duration: "4h",
    chaptersCount: 2,
    chapters: [
      { id: "c1", title: "Chapter 1", layout: "SingleContent" as ChapterLayout, orderIndex: 0, blockCount: 1 },
      { id: "c2", title: "Chapter 2", layout: "SingleContent" as ChapterLayout, orderIndex: 1, blockCount: 1 },
    ],
    instructor: "Test Instructor",
    instructorRole: "Test Role",
    enrolledCount: 100,
    rating: 4.5,
    imageUrl: "/test.jpg",
    tags: ["test"],
    updatedAt: "2026-01-01",
    isMandatory: false,
    badgeLevel: "bronze" as BadgeLevel,
    credits: 10,
    ...overrides,
  };
}

describe("Training type contract", () => {
  it("mandatory training is flagged correctly", () => {
    const training = makeTraining({ isMandatory: true });
    expect(training.isMandatory).toBe(true);
  });

  it("optional training is flagged correctly", () => {
    const training = makeTraining({ isMandatory: false });
    expect(training.isMandatory).toBe(false);
  });

  it("badge level accepts all valid values", () => {
    const levels: BadgeLevel[] = ["bronze", "silver", "gold"];
    for (const level of levels) {
      const training = makeTraining({ badgeLevel: level });
      expect(training.badgeLevel).toBe(level);
    }
  });

  it("credits is a positive number", () => {
    const training = makeTraining({ credits: 25 });
    expect(training.credits).toBe(25);
    expect(training.credits).toBeGreaterThan(0);
  });

  it("training with exam includes exam info", () => {
    const training = makeTraining({
      exam: {
        questionsCount: 20,
        passingScore: 75,
        timeLimit: "30 min",
        maxAttempts: 3,
      },
    });
    expect(training.exam).toBeDefined();
    expect(training.exam!.questionsCount).toBe(20);
    expect(training.exam!.passingScore).toBe(75);
  });

  it("training without exam has undefined exam field", () => {
    const training = makeTraining();
    expect(training.exam).toBeUndefined();
  });
});
