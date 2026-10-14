import { describe, expect, it } from "vitest";
import { moveRatingLevel, validateRatingLevels } from "./rating-scale-model";
import type { RatingScaleLevelDto } from "@repo/api";

const levels: RatingScaleLevelDto[] = [
  { value: 1, label: "Needs improvement", description: null },
  { value: 2, label: "Developing", description: null },
  { value: 3, label: "Effective", description: null },
];

describe("rating scale editor model", () => {
  it("moves levels and keeps values in display order", () => {
    expect(moveRatingLevel(levels, 0, 1).map(({ value, label }) => [value, label])).toEqual([
      [1, "Developing"], [2, "Needs improvement"], [3, "Effective"],
    ]);
    expect(moveRatingLevel(levels, 0, -1)).toBe(levels);
  });

  it("enforces bounds and unique non-empty labels", () => {
    expect(validateRatingLevels(levels)).toBeNull();
    expect(validateRatingLevels(levels.slice(0, 2))).toBe("Use 3 to 7 rating levels.");
    const eightLevels = Array.from({ length: 8 }, (_, index) => ({
      value: index + 1, label: `Level ${index + 1}`, description: null,
    }));
    expect(validateRatingLevels(eightLevels)).toBe("Use 3 to 7 rating levels.");
    expect(validateRatingLevels([levels[0]!, { ...levels[1]!, label: " needs IMPROVEMENT " }, levels[2]!])).toBe("Each level needs a unique label.");
    expect(validateRatingLevels([levels[0]!, { ...levels[1]!, label: " " }, levels[2]!])).toBe("Every level needs a label.");
  });
});
