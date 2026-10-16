import { useCallback, useEffect, useRef, useState } from "react";
import type { ObjectiveCoachRequest, ObjectiveCoachSurface } from "@repo/api";
import { useApis } from "../../api/use-performance";
import { useWorkspaceContext } from "../../api/use-workspace";
import { stateFromResult, withoutPart, type CoachPart, type CoachState } from "./coach-model";

export type CoachDraft = Omit<ObjectiveCoachRequest, "surface" | "orgUnitId">;

/** How long the title must stay still before the coach's one automatic run. */
export const AUTO_COACH_IDLE_MS = 1200;

/**
 * The AI objective coach for one composer session (D-07). Offered only while the workspace says
 * AI is available. One request at a time; closing the composer aborts it. Any failure hides the
 * coach quietly for the rest of the session: AI never shows an error (D-26).
 */
export function useObjectiveCoach({
  open,
  cycleId,
  surface,
  orgUnitId,
}: {
  open: boolean;
  cycleId: string;
  surface: ObjectiveCoachSurface;
  orgUnitId?: string | null;
}) {
  const { performance } = useApis();
  const context = useWorkspaceContext();
  const available = context.data?.capabilities.aiAssistance === true && (surface === "Plan" || Boolean(orgUnitId));
  const [state, setState] = useState<CoachState>({ kind: "idle" });
  const controllerRef = useRef<AbortController | null>(null);
  const autoRanRef = useRef(false);

  // Each opening is a new session: earlier suggestions and the automatic run start over.
  useEffect(() => {
    if (!open) return;
    setState({ kind: "idle" });
    autoRanRef.current = false;
    return () => controllerRef.current?.abort();
  }, [open]);

  const run = useCallback(
    async (draft: CoachDraft) => {
      if (!available || draft.title.trim() === "") return;
      controllerRef.current?.abort();
      const controller = new AbortController();
      controllerRef.current = controller;
      setState({ kind: "running" });
      try {
        const result = await performance.coachObjective(cycleId, { ...draft, surface, orgUnitId: orgUnitId ?? null }, controller.signal);
        if (!controller.signal.aborted) setState(stateFromResult(result));
      } catch {
        if (!controller.signal.aborted) setState({ kind: "hidden" });
      }
    },
    [available, cycleId, orgUnitId, performance, surface]
  );

  const settle = useCallback((part: CoachPart) => setState((current) => withoutPart(current, part)), []);

  return {
    /** Render the coach at all. */
    enabled: available && state.kind !== "hidden",
    state,
    run,
    /** The suggestion was applied or dismissed. */
    settle,
    autoRanRef,
  };
}

/**
 * The one automatic run per session: once the draft has a title and a measurement method and the
 * title has been still for a moment. Later runs happen only on request.
 */
export function useAutoCoach({
  coach,
  ready,
  title,
  draft,
}: {
  coach: ReturnType<typeof useObjectiveCoach>;
  ready: boolean;
  title: string;
  draft: () => CoachDraft;
}) {
  const draftRef = useRef(draft);
  draftRef.current = draft;
  const { enabled, run, autoRanRef } = coach;
  useEffect(() => {
    if (!enabled || !ready || title.trim() === "" || autoRanRef.current) return;
    const timer = window.setTimeout(() => {
      autoRanRef.current = true;
      void run(draftRef.current());
    }, AUTO_COACH_IDLE_MS);
    return () => window.clearTimeout(timer);
  }, [enabled, ready, title, run, autoRanRef]);
}
