import type { ObjectiveRef, ObjectiveRecordMode } from "@/features/performance/components/objective-record/objective-ref";

/**
 * The one place Performance record addresses are built. A record is addressed by its own identity —
 * with its Cycle where the address needs one — so a link keeps resolving to the same historical record
 * after another Cycle becomes current. Never hand-build these paths at call sites.
 */
const segment = encodeURIComponent;

export function objectiveHref(ref: ObjectiveRef, mode: ObjectiveRecordMode = "details") {
  const path = `/cycles/${segment(ref.cycleId)}/objectives/${segment(ref.objectiveId)}`;
  return mode === "record" ? `${path}?mode=record` : path;
}

export type PlanRef = { cycleId: string; planId: string };

export function planHref(ref: PlanRef) {
  return `/cycles/${segment(ref.cycleId)}/plans/${segment(ref.planId)}`;
}

export function reviewHref(reviewId: string) {
  return `/reviews/${segment(reviewId)}`;
}

export function roundHref(roundId: string) {
  return `/reviews/rounds/${segment(roundId)}`;
}

export function newReviewRoundHref() {
  return "/reviews/rounds/new";
}

export function roundSetupHref(roundId: string, step: "details" | "population" | "review") {
  return `${roundHref(roundId)}/setup/${step}`;
}

export function calibrationHref(roundId: string) {
  return `${roundHref(roundId)}/calibration`;
}

/**
 * A workspace address carrying the selected Cycle. Record addresses already carry their own Cycle and
 * are returned unchanged.
 */
export function withCycle(href: string, cycleId: string | null | undefined) {
  if (!cycleId || isCycleAddress(href)) return href;
  const [path, query = ""] = href.split("?", 2);
  const params = new URLSearchParams(query);
  params.set("cycle", cycleId);
  return `${path}?${params.toString()}`;
}

export function isCycleAddress(href: string) {
  return href.startsWith("/cycles/");
}
