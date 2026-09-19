import type { CycleDetailDto } from "@repo/api";

/**
 * The cycle-setup journey as domain-derived state — never a persisted wizard flag.
 * Every step's completion is read straight from the Cycle's own launch readiness, so the
 * stepper and the route guards always agree with the backend's single source of truth.
 */
export type SetupStep = "details" | "population" | "review";

export const SETUP_STEPS: { key: SetupStep; label: string; caption: string }[] = [
  { key: "details", label: "Cycle details", caption: "Name and timeline" },
  { key: "population", label: "Population", caption: "Select participants" },
  { key: "review", label: "Review & launch", caption: "Confirm and activate" },
];

export interface SetupState {
  hasDraft: boolean;
  detailsComplete: boolean;
  populationComplete: boolean;
  readyToLaunch: boolean;
}

function areaComplete(detail: CycleDetailDto, key: string): boolean {
  return detail.launchReadiness.areas.find((area) => area.key === key)?.complete ?? false;
}

/**
 * Setup applies only to a Draft Cycle. A non-draft (Active/Closed) is an established Cycle,
 * not something being set up — callers redirect it out of the setup shell.
 */
export function deriveSetupState(detail: CycleDetailDto | null | undefined): SetupState {
  const isDraft = detail?.cycle.state === "Draft";
  if (!detail || !isDraft) {
    return { hasDraft: false, detailsComplete: false, populationComplete: false, readyToLaunch: false };
  }
  return {
    hasDraft: true,
    detailsComplete: areaComplete(detail, "details"),
    populationComplete: areaComplete(detail, "population"),
    readyToLaunch: detail.launchReadiness.canActivate,
  };
}

/** The earliest step still needing work — the safe landing target for deep links and redirects. */
export function earliestIncompleteStep(state: SetupState): SetupStep {
  if (!state.hasDraft || !state.detailsComplete) return "details";
  if (!state.populationComplete) return "population";
  return "review";
}

/** Whether a step's prerequisites exist yet. Backward navigation to earlier steps is always safe. */
export function canAccessStep(step: SetupStep, state: SetupState): boolean {
  if (step === "details") return true;
  if (step === "population") return state.hasDraft;
  return state.hasDraft && state.populationComplete;
}

export function setupStepHref(step: SetupStep): string {
  return `/cycle/setup/${step}`;
}
