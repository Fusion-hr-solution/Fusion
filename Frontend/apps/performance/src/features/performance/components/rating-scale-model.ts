import type { RatingScaleLevelDto } from "@repo/api";

export function moveRatingLevel(levels: RatingScaleLevelDto[], index: number, offset: -1 | 1) {
  const target = index + offset;
  if (target < 0 || target >= levels.length) return levels;
  const next = [...levels];
  [next[index], next[target]] = [next[target]!, next[index]!];
  return next.map((level, position) => ({ ...level, value: position + 1 }));
}

export function validateRatingLevels(levels: RatingScaleLevelDto[]) {
  if (levels.length < 3 || levels.length > 7) return "Use 3 to 7 rating levels.";
  const labels = levels.map(({ label }) => label.trim().toLocaleLowerCase());
  if (labels.some((label) => !label)) return "Every level needs a label.";
  if (new Set(labels).size !== labels.length) return "Each level needs a unique label.";
  return null;
}
