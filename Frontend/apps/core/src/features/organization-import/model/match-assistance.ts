import type { OrganizationImportSemanticAssistance } from "@repo/api";

export type AssistanceAction = { label: string; retry: boolean; grantConsent: boolean };

/** What the Match banner says about automatic matching, and what it offers, for every outcome. */
export type AssistanceView = { summary: string; action: AssistanceAction | null };

const plural = (count: number, one: string, many: string) => (count === 1 ? one : many);

function needs(count: number, still: boolean) {
  return `${count} ${plural(count, "item", "items")} ${still ? "still " : ""}${plural(count, "needs", "need")} your review.`;
}

/**
 * One sentence per outcome, never inferred by the reader:
 * - AI matched everything, or part of it (with what is left)
 * - AI answered but matched nothing it was sure of
 * - AI could not finish (with a retry when one could help) or is unavailable
 * - no AI involved at all (Fusion's own rules, or nothing to ask)
 */
export function describeAssistance(
  assistance: OrganizationImportSemanticAssistance | null | undefined,
  needsReview: number
): AssistanceView {
  const applied = assistance?.appliedCount ?? 0;
  const matched = applied > 0 ? `AI matched ${applied} ${plural(applied, "item", "items")}.` : "";

  if (needsReview === 0)
    return { summary: applied > 0 ? `${matched} Everything is ready for review.` : "Everything is matched.", action: null };

  switch (assistance?.state) {
    case "Running":
      return { summary: needs(needsReview, false), action: null };
    case "Succeeded":
      return applied > 0
        ? { summary: `${matched} ${needs(needsReview, true)}`, action: null }
        : { summary: `AI wasn't confident about any of these. ${needs(needsReview, false)}`, action: null };
    case "Failed":
      return assistance.canRetry
        ? {
            summary: `${matched ? `${matched} ` : ""}AI matching didn't finish. ${needs(needsReview, false)}`,
            action: { label: "Retry AI matching", retry: true, grantConsent: false },
          }
        : { summary: `AI matching isn't available right now. ${needs(needsReview, false)}`, action: null };
    case "Stale":
    case "Ready":
      return {
        summary: `${matched ? `${matched} ` : ""}${needs(needsReview, applied > 0)}`,
        action: { label: applied > 0 ? "Match new labels with AI" : "Match with AI", retry: false, grantConsent: false },
      };
    case "AwaitingConsent":
      return { summary: needs(needsReview, false), action: { label: "Match with AI", retry: false, grantConsent: true } };
    default:
      // NotNeeded or Skipped: no AI involved; the remaining items are simply the administrator's.
      return { summary: needs(needsReview, false), action: null };
  }
}
