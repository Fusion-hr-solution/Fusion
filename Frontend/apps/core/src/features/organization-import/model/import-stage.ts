import type { OrganizationImportSessionDto } from "@repo/api";

/**
 * The user-facing stage an import attempt is in. Routes reflect these jobs, never backend
 * phases: `/import/{id}` resolves to `match` or `review`, and a finished attempt leaves the
 * import entirely.
 */
export type ImportStage = "match" | "review" | "committed" | "discarded";

/** How Match was satisfied, for the journey: still needed, never needed, or settled by the administrator. */
export type MatchOutcome = "needed" | "automatic" | "confirmed";

/**
 * Can Fusion produce a complete canonical interpretation of this source? It can when the
 * source's shape and required columns are settled and every source term has a meaning.
 * Semantic assistance is optional help inside Match, so its lifecycle (pending, failed,
 * available, not eligible) is deliberately not an input here.
 */
export function hasCompleteInterpretation(session: OrganizationImportSessionDto): boolean {
  return session.match?.readiness.canContinue === true;
}

export function deriveImportStage(session: OrganizationImportSessionDto): ImportStage {
  if (session.status === "Committed") return "committed";
  if (session.status === "Discarded") return "discarded";
  return hasCompleteInterpretation(session) ? "review" : "match";
}

export function deriveMatchOutcome(session: OrganizationImportSessionDto): MatchOutcome {
  switch (session.match?.completionKind) {
    case "Automatic": return "automatic";
    case "Confirmed": return "confirmed";
    default: return "needed";
  }
}

export function importStageHref(sessionId: string, stage: "match" | "review") {
  return `/organization/import/${sessionId}/${stage}`;
}
