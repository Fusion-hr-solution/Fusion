import type {
  CalibrationDiscussionState,
  CalibrationDistributionDto,
  CalibrationSubjectDto,
  RatingScaleLevelDto,
} from "@repo/api";

/** The subject table's filters, in the order the spec names them. Values are what a chip shows. */
export interface CalibrationFilters {
  orgUnit: string[];
  manager: string[];
  rating: string[];
  changed: ("changed" | "unchanged")[];
  discussed: ("discussed" | "not-discussed")[];
}

export const NO_UNIT = "No organizational unit";

export function emptyFilters(): CalibrationFilters {
  return { orgUnit: [], manager: [], rating: [], changed: [], discussed: [] };
}

/** Distinct values present in the session, so a filter never offers an option that matches nothing. */
export function filterOptions(subjects: CalibrationSubjectDto[], scale: RatingScaleLevelDto[]) {
  const sorted = (values: Iterable<string>) => [...new Set(values)].sort((a, b) => a.localeCompare(b));
  const ratings = new Set(subjects.map((subject) => subject.currentRating));
  return {
    orgUnit: sorted(subjects.map((subject) => subject.orgUnitName ?? NO_UNIT)),
    manager: sorted(subjects.map((subject) => subject.reviewerDisplayName)),
    rating: scale.filter((level) => ratings.has(level.value)).map((level) => ({ value: String(level.value), label: level.label })),
  };
}

/** A subject's value on one filter dimension: the single source the table's chips and these tests share. */
export function subjectFilterValue(subject: CalibrationSubjectDto, dimension: keyof CalibrationFilters): string {
  switch (dimension) {
    case "orgUnit": return subject.orgUnitName ?? NO_UNIT;
    case "manager": return subject.reviewerDisplayName;
    case "rating": return String(subject.currentRating);
    case "changed": return subject.adjusted ? "changed" : "unchanged";
    case "discussed": return subject.discussionState === "Discussed" ? "discussed" : "not-discussed";
  }
}

export function matchesFilters(subject: CalibrationSubjectDto, filters: CalibrationFilters): boolean {
  return (Object.keys(filters) as (keyof CalibrationFilters)[]).every((dimension) => {
    const selected = filters[dimension] as string[];
    return selected.length === 0 || selected.includes(subjectFilterValue(subject, dimension));
  });
}

/**
 * The distribution as drawable rows: each level's original and current counts against one shared maximum,
 * so both series read on the same axis. The delta is what moved through calibration.
 */
export function distributionRows(distribution: CalibrationDistributionDto[]) {
  const max = Math.max(1, ...distribution.flatMap((level) => [level.original, level.current]));
  return distribution.map((level) => ({
    ...level,
    originalShare: level.original / max,
    currentShare: level.current / max,
    delta: level.current - level.original,
  }));
}

/** A subject's distribution after a local edit, before the server answers. Original never moves. */
export function applyLocalRating(distribution: CalibrationDistributionDto[], from: number, to: number) {
  if (from === to) return distribution;
  return distribution.map((level) => ({
    ...level,
    current: level.current + (level.value === to ? 1 : 0) - (level.value === from ? 1 : 0),
  }));
}

export interface SubjectDraft {
  rating: number;
  rationale: string;
  discussed: boolean;
}

export function draftFor(subject: CalibrationSubjectDto): SubjectDraft {
  return { rating: subject.currentRating, rationale: subject.rationale ?? "", discussed: subject.discussionState === "Discussed" };
}

/** A rating that differs from the manager's needs a reason; returning to it does not. */
export function draftProblem(subject: CalibrationSubjectDto, draft: SubjectDraft): string | null {
  if (draft.rating !== subject.originalRating && !draft.rationale.trim()) return "Add a rationale for changing the manager's rating.";
  if (draft.rationale.trim().length > 2000) return "Keep the rationale under 2,000 characters.";
  return null;
}

export function isDirty(subject: CalibrationSubjectDto, draft: SubjectDraft): boolean {
  const saved = draftFor(subject);
  const rationale = draft.rating === subject.originalRating ? "" : draft.rationale.trim();
  const savedRationale = saved.rating === subject.originalRating ? "" : saved.rationale.trim();
  return draft.rating !== saved.rating || draft.discussed !== saved.discussed || rationale !== savedRationale;
}

export function discussionState(discussed: boolean): CalibrationDiscussionState {
  return discussed ? "Discussed" : "NotDiscussed";
}

export function levelLabel(scale: RatingScaleLevelDto[], value: number | null | undefined) {
  if (value == null) return "No rating";
  return scale.find((level) => level.value === value)?.label ?? `Level ${value}`;
}
