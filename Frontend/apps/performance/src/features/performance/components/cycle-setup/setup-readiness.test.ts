import { describe, expect, it } from "vitest";
import type { CycleDetailDto } from "@repo/api";
import {
  canAccessStep,
  deriveSetupState,
  earliestIncompleteStep,
} from "./setup-readiness";

type Area = { key: string; complete: boolean };

function detail(opts: {
  state?: "Draft" | "Active" | "Closed";
  areas: Area[];
  canActivate: boolean;
}): CycleDetailDto {
  return {
    cycle: {
      id: "c1",
      name: "FY2026",
      description: null,
      startDate: "2026-01-01",
      endDate: "2026-12-31",
      planningDeadline: "2026-01-31",
      state: opts.state ?? "Draft",
      activatedAt: null,
    },
    launchReadiness: {
      canActivate: opts.canActivate,
      areas: opts.areas.map((a) => ({ key: a.key, label: a.key, complete: a.complete, detail: null })),
      blockers: [],
    },
    milestones: [],
    publishedStrategyCount: 0,
    draftStrategyCount: 0,
    populationConfirmed: opts.areas.find((a) => a.key === "population")?.complete ?? false,
    confirmedParticipantCount: 0,
    otherActiveCycleExists: false,
  } as CycleDetailDto;
}

describe("deriveSetupState", () => {
  it("has no draft when there is no cycle", () => {
    expect(deriveSetupState(null)).toEqual({
      hasDraft: false,
      detailsComplete: false,
      populationComplete: false,
      readyToLaunch: false,
    });
  });

  it("treats an Active cycle as not-in-setup", () => {
    const state = deriveSetupState(
      detail({ state: "Active", areas: [{ key: "details", complete: true }, { key: "population", complete: true }], canActivate: false }),
    );
    expect(state.hasDraft).toBe(false);
  });

  it("reads completion from the draft's launch readiness areas", () => {
    const state = deriveSetupState(
      detail({ areas: [{ key: "details", complete: true }, { key: "population", complete: false }], canActivate: false }),
    );
    expect(state).toMatchObject({ hasDraft: true, detailsComplete: true, populationComplete: false, readyToLaunch: false });
  });

  it("is ready to launch only when the cycle can activate", () => {
    const state = deriveSetupState(
      detail({ areas: [{ key: "details", complete: true }, { key: "population", complete: true }], canActivate: true }),
    );
    expect(state).toMatchObject({ populationComplete: true, readyToLaunch: true });
  });
});

describe("earliestIncompleteStep", () => {
  it("is details when no draft exists yet", () => {
    expect(earliestIncompleteStep(deriveSetupState(null))).toBe("details");
  });

  it("is population once details are complete but population is not", () => {
    const state = deriveSetupState(
      detail({ areas: [{ key: "details", complete: true }, { key: "population", complete: false }], canActivate: false }),
    );
    expect(earliestIncompleteStep(state)).toBe("population");
  });

  it("is review once population is confirmed", () => {
    const state = deriveSetupState(
      detail({ areas: [{ key: "details", complete: true }, { key: "population", complete: true }], canActivate: true }),
    );
    expect(earliestIncompleteStep(state)).toBe("review");
  });
});

describe("canAccessStep", () => {
  const noDraft = deriveSetupState(null);
  const draftOnly = deriveSetupState(
    detail({ areas: [{ key: "details", complete: true }, { key: "population", complete: false }], canActivate: false }),
  );
  const confirmed = deriveSetupState(
    detail({ areas: [{ key: "details", complete: true }, { key: "population", complete: true }], canActivate: true }),
  );

  it("always allows details", () => {
    expect(canAccessStep("details", noDraft)).toBe(true);
    expect(canAccessStep("details", confirmed)).toBe(true);
  });

  it("allows population only once a draft exists", () => {
    expect(canAccessStep("population", noDraft)).toBe(false);
    expect(canAccessStep("population", draftOnly)).toBe(true);
  });

  it("allows review only once population is confirmed", () => {
    expect(canAccessStep("review", draftOnly)).toBe(false);
    expect(canAccessStep("review", confirmed)).toBe(true);
  });
});
