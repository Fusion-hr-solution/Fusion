import { describe, expect, it } from "vitest";
import type { CalibrationSubjectDto, RatingScaleLevelDto } from "@repo/api";
import {
  NO_UNIT,
  applyLocalRating,
  distributionRows,
  draftFor,
  draftProblem,
  emptyFilters,
  filterOptions,
  isDirty,
  matchesFilters,
} from "./calibration-model";

const scale: RatingScaleLevelDto[] = [
  { value: 1, label: "Needs improvement", description: null },
  { value: 2, label: "Developing", description: null },
  { value: 3, label: "Effective", description: null },
  { value: 4, label: "Strong", description: null },
];

function subject(overrides: Partial<CalibrationSubjectDto>): CalibrationSubjectDto {
  return {
    reviewId: "r1", subjectDisplayName: "Youssef", reviewerDisplayName: "Rania", orgUnitName: "People Operations",
    jobTitle: null, reviewState: "Calibration", originalRating: 4, calibratedRating: null, currentRating: 4,
    adjusted: false, rationale: null, discussionState: "NotDiscussed", version: 1, history: [], ...overrides,
  };
}

describe("calibration filters", () => {
  const subjects = [
    subject({ reviewId: "a" }),
    subject({ reviewId: "b", orgUnitName: null, reviewerDisplayName: "Salma", calibratedRating: 3, currentRating: 3, adjusted: true, discussionState: "Discussed" }),
  ];

  it("offers only values present in the session, ratings in scale order", () => {
    const options = filterOptions(subjects, scale);
    expect(options.orgUnit).toEqual([NO_UNIT, "People Operations"]);
    expect(options.manager).toEqual(["Rania", "Salma"]);
    expect(options.rating.map((option) => option.label)).toEqual(["Effective", "Strong"]);
  });

  it("combines filters across dimensions and treats an empty selection as all", () => {
    const pick = (filters: Partial<ReturnType<typeof emptyFilters>>) =>
      subjects.filter((item) => matchesFilters(item, { ...emptyFilters(), ...filters })).map((item) => item.reviewId);
    expect(pick({})).toEqual(["a", "b"]);
    expect(pick({ changed: ["changed"] })).toEqual(["b"]);
    expect(pick({ discussed: ["not-discussed"] })).toEqual(["a"]);
    expect(pick({ orgUnit: [NO_UNIT], rating: ["3"] })).toEqual(["b"]);
    expect(pick({ manager: ["Rania"], changed: ["changed"] })).toEqual([]);
  });
});

describe("distribution", () => {
  const levels = [
    { value: 3, label: "Effective", original: 1, current: 1 },
    { value: 4, label: "Strong", original: 3, current: 3 },
  ];

  it("scales both series against one maximum and reports what moved", () => {
    const moved = applyLocalRating(levels, 4, 3);
    expect(moved.map((level) => [level.original, level.current])).toEqual([[1, 2], [3, 2]]);
    const rows = distributionRows(moved);
    expect(rows.map((row) => row.delta)).toEqual([1, -1]);
    expect(rows[1]!.originalShare).toBe(1);
    expect(rows[0]!.currentShare).toBeCloseTo(2 / 3);
  });

  it("keeps an empty session drawable", () => {
    expect(distributionRows([{ value: 1, label: "Low", original: 0, current: 0 }])[0]!.currentShare).toBe(0);
  });
});

describe("subject drafts", () => {
  it("requires a rationale only when the rating leaves the manager's", () => {
    const base = subject({});
    expect(draftProblem(base, { ...draftFor(base), rating: 3 })).toMatch(/rationale/);
    expect(draftProblem(base, { ...draftFor(base), rating: 3, rationale: "Peers were stronger" })).toBeNull();
    expect(draftProblem(base, draftFor(base))).toBeNull();
  });

  it("ignores a stale rationale once the rating is restored", () => {
    const adjusted = subject({ calibratedRating: 3, currentRating: 3, adjusted: true, rationale: "Peers" });
    expect(isDirty(adjusted, draftFor(adjusted))).toBe(false);
    expect(isDirty(adjusted, { ...draftFor(adjusted), rating: 4 })).toBe(true);
    const restored = subject({});
    expect(isDirty(restored, { ...draftFor(restored), rationale: "typed then dropped" })).toBe(false);
  });
});
