import type { OrganizationImportSemanticAssistance } from "@repo/api";
import { englishSay, type Say } from "@repo/ds/lib/say";
import { englishMessages } from "@/i18n/messages";

export type AssistanceAction = { label: string; retry: boolean; grantConsent: boolean };

/** What the Match banner says about automatic matching, and what it offers, for every outcome. */
export type AssistanceView = { summary: string; action: AssistanceAction | null };

const ENGLISH = englishSay(englishMessages, "dataImport");

/**
 * One sentence per outcome, never inferred by the reader:
 * - AI matched everything, or part of it (with what is left)
 * - AI answered but matched nothing it was sure of
 * - AI could not finish (with a retry when one could help) or is unavailable
 * - no AI involved at all (Fusion's own rules, or nothing to ask)
 */
export function describeAssistance(
  assistance: OrganizationImportSemanticAssistance | null | undefined,
  needsReview: number,
  say: Say = ENGLISH
): AssistanceView {
  const applied = assistance?.appliedCount ?? 0;
  const matched = applied > 0 ? say("assistance.matched", { count: applied }) : "";
  const needs = (count: number, still: boolean) =>
    say(still ? "assistance.stillNeeds" : "assistance.needs", { count });

  if (needsReview === 0)
    return {
      summary: applied > 0 ? `${matched} ${say("assistance.readyForReview")}` : say("assistance.allMatched"),
      action: null,
    };

  switch (assistance?.state) {
    case "Running":
      return { summary: needs(needsReview, false), action: null };
    case "Succeeded":
      return applied > 0
        ? { summary: `${matched} ${needs(needsReview, true)}`, action: null }
        : { summary: `${say("assistance.notConfident")} ${needs(needsReview, false)}`, action: null };
    case "Failed":
      return assistance.canRetry
        ? {
            summary: `${matched ? `${matched} ` : ""}${say("assistance.didntFinish")} ${needs(needsReview, false)}`,
            action: { label: say("assistance.retry"), retry: true, grantConsent: false },
          }
        : { summary: `${say("assistance.unavailable")} ${needs(needsReview, false)}`, action: null };
    case "Stale":
    case "Ready":
      return {
        summary: `${matched ? `${matched} ` : ""}${needs(needsReview, applied > 0)}`,
        action: {
          label: applied > 0 ? say("assistance.matchNew") : say("assistance.match"),
          retry: false,
          grantConsent: false,
        },
      };
    case "AwaitingConsent":
      return { summary: needs(needsReview, false), action: { label: say("assistance.match"), retry: false, grantConsent: true } };
    default:
      // NotNeeded or Skipped: no AI involved; the remaining items are simply the administrator's.
      return { summary: needs(needsReview, false), action: null };
  }
}
