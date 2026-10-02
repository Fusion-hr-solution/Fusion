/**
 * How an objective is addressed anywhere in Performance: by the Cycle it belongs to *and* its own id.
 * Never by objective id resolved against "the current Cycle" — a review, a result or a closed Cycle must
 * still be able to open the exact objective it refers to after the tenant has moved on to the next Cycle.
 */
export type ObjectiveRef = { cycleId: string; objectiveId: string };

/** What the record is opened for: reading it, or recording progress on it. */
export type ObjectiveRecordMode = "details" | "record";

export const OBJECTIVE_PARAMS = {
  cycle: "cycle",
  objective: "objective",
  mode: "mode",
} as const;

/** The objective a URL addresses, or null when none (or only half a reference) is present. */
export function parseObjectiveRef(params: URLSearchParams): ObjectiveRef | null {
  const cycleId = params.get(OBJECTIVE_PARAMS.cycle);
  const objectiveId = params.get(OBJECTIVE_PARAMS.objective);
  return cycleId && objectiveId ? { cycleId, objectiveId } : null;
}

export function parseObjectiveMode(params: URLSearchParams): ObjectiveRecordMode {
  return params.get(OBJECTIVE_PARAMS.mode) === "record" ? "record" : "details";
}

/**
 * The search string with the record opened on `ref` (or closed when null). Only the record's own
 * parameters change; everything else the page keeps in its URL (a focused branch, a working scope)
 * is preserved.
 */
export function withObjectiveRef(
  current: URLSearchParams,
  ref: ObjectiveRef | null,
  mode: ObjectiveRecordMode = "details"
): string {
  const next = new URLSearchParams(current);
  next.delete(OBJECTIVE_PARAMS.cycle);
  next.delete(OBJECTIVE_PARAMS.objective);
  next.delete(OBJECTIVE_PARAMS.mode);
  if (ref) {
    next.set(OBJECTIVE_PARAMS.cycle, ref.cycleId);
    next.set(OBJECTIVE_PARAMS.objective, ref.objectiveId);
    if (mode === "record") next.set(OBJECTIVE_PARAMS.mode, "record");
  }
  const query = next.toString();
  return query ? `?${query}` : "";
}

export function sameObjective(a: ObjectiveRef | null, b: ObjectiveRef | null): boolean {
  return a !== null && b !== null && a.cycleId === b.cycleId && a.objectiveId === b.objectiveId;
}
