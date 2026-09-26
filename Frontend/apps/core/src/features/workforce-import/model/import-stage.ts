import type { WorkforceImportSessionDto } from "@repo/api";

/**
 * The user-facing stage a workforce import attempt is in. Routes reflect these jobs, never
 * backend phases: `/people/import/{id}` resolves to `match` or `review`, and a finished attempt
 * leaves the import entirely. Publishing is Review's terminal action, not a stage.
 */
export type WorkforceImportStage = "match" | "review" | "committed" | "discarded";

/** How Match was satisfied, for the journey: still needed, never needed, or settled by the administrator. */
export type WorkforceMatchOutcome = "needed" | "automatic" | "confirmed";

/**
 * Can Fusion build a canonical workforce proposal from this source? It can when every required
 * meaning is settled (columns, identity, formats, status vocabulary). Semantic assistance is
 * optional help inside Match, so its state is deliberately not an input here.
 */
export function hasCompleteMatch(session: WorkforceImportSessionDto): boolean {
  return session.match?.readiness.canContinue ?? session.matchComplete;
}

export function deriveWorkforceImportStage(session: WorkforceImportSessionDto): WorkforceImportStage {
  if (session.status === "Committed") return "committed";
  if (session.status === "Discarded") return "discarded";
  // A publication in flight is watched from Review, where it was started.
  if (session.publication && (session.publication.status === "Queued" || session.publication.status === "Running")) return "review";
  return hasCompleteMatch(session) ? "review" : "match";
}

export function deriveWorkforceMatchOutcome(session: WorkforceImportSessionDto): WorkforceMatchOutcome {
  switch (session.match?.readiness.completionKind) {
    case "Automatic":
      return "automatic";
    case "Confirmed":
      return "confirmed";
    default:
      return session.matchComplete ? "confirmed" : "needed";
  }
}

export function workforceImportStageHref(sessionId: string, stage: "match" | "review") {
  return `/people/import/${sessionId}/${stage}`;
}

/** Where a finished attempt goes: the people it established, or back to Upload. */
export function workforceImportExitHref(session: WorkforceImportSessionDto): string {
  return session.status === "Committed" ? `/people?importBatch=${session.id}` : "/people/import";
}

/**
 * Where the attempt belongs when the URL doesn't reflect it, or null when it does. A finished
 * attempt leaves the import; the bare attempt URL resolves to its stage; Review is unreachable
 * until Match is complete. Match stays reachable from Review: revisiting it is a choice.
 */
export function workforceImportGuardTarget(
  session: WorkforceImportSessionDto,
  stage: WorkforceImportStage,
  segment: string | null
): string | null {
  if (stage === "committed" || stage === "discarded") return workforceImportExitHref(session);
  if (segment !== "match" && segment !== "review") return workforceImportStageHref(session.id, stage);
  if (segment === "review" && stage === "match") return workforceImportStageHref(session.id, "match");
  return null;
}
