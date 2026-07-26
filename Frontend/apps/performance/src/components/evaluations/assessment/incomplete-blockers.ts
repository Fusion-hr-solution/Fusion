import { ApiError, type AssessmentIncompleteItemDto } from "@repo/api";

function isIncompleteItem(value: unknown): value is AssessmentIncompleteItemDto {
  if (value === null || typeof value !== "object") return false;
  const item = value as Record<string, unknown>;
  return (
    typeof item.id === "string" &&
    typeof item.kind === "string" &&
    typeof item.section === "string" &&
    typeof item.label === "string"
  );
}

/**
 * Extracts the structured incomplete-submission blockers a failed submit
 * carries in the response envelope's `details`. Empty when the failure was
 * anything else — callers fall back to the error message.
 */
export function incompleteItemsFromError(
  error: unknown
): AssessmentIncompleteItemDto[] {
  if (!(error instanceof ApiError) || !Array.isArray(error.details)) return [];
  return error.details.filter(isIncompleteItem);
}

/** DOM anchor id for a frozen item, shared by content sections and blocker links. */
export function assessmentItemAnchor(id: string): string {
  return `assessment-item-${id}`;
}

/** DOM anchor id for a workspace section. */
export function assessmentSectionAnchor(sectionId: string): string {
  return `assessment-section-${sectionId}`;
}
