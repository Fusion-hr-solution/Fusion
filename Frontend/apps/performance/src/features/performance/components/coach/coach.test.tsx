// @vitest-environment happy-dom
import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { measurePreview, stateFromResult, withoutPart } from "./coach-model";
import { useObjectiveCoach } from "./use-objective-coach";

const coachObjective = vi.hoisted(() => vi.fn());
const capabilities = vi.hoisted(() => ({ aiAssistance: true }));
vi.mock("../../api/use-performance", () => ({ useApis: () => ({ performance: { coachObjective } }) }));
vi.mock("../../api/use-workspace", () => ({ useWorkspaceContext: () => ({ data: { capabilities } }) }));

describe("coach model", () => {
  it("reads a numeric measure with or without a stated baseline", () => {
    const base = { method: "NumericTarget" as const, unit: "days", direction: "Decrease" as const, milestones: null };
    expect(measurePreview({ ...base, baseline: null, target: 5 })).toBe("Number · Decrease · target 5 days");
    expect(measurePreview({ ...base, baseline: 10, target: 5 })).toBe("Number · Decrease · 10 to 5 days");
  });

  it("reads milestones by their weights", () => {
    expect(
      measurePreview({
        method: "WeightedMilestones", baseline: null, target: null, unit: null, direction: null,
        milestones: [{ title: "a", weight: 40 }, { title: "b", weight: 30 }, { title: "c", weight: 30 }],
      })
    ).toBe("3 milestones · 40 / 30 / 30");
  });

  it("goes quiet once every suggestion is applied or dismissed", () => {
    let state = stateFromResult({ outcome: "Suggested", title: "Sharper", measure: null, parentObjectiveId: "p1" });
    state = withoutPart(state, "title");
    expect(state.kind).toBe("ready");
    state = withoutPart(state, "parent");
    expect(state.kind).toBe("idle");
  });

  it("treats a result with nothing in it as nothing to suggest", () => {
    expect(stateFromResult({ outcome: "NothingToSuggest", title: null, measure: null, parentObjectiveId: null }).kind).toBe("nothing");
  });
});

describe("useObjectiveCoach", () => {
  beforeEach(() => {
    capabilities.aiAssistance = true;
    coachObjective.mockReset();
  });

  it("needs the team before the team coach is offered", () => {
    const { result } = renderHook(() => useObjectiveCoach({ open: true, cycleId: "c1", surface: "Team", orgUnitId: null }));
    expect(result.current.enabled).toBe(false);
  });

  it("asks for the team's suggestions with its unit", async () => {
    coachObjective.mockResolvedValue({ outcome: "NothingToSuggest", title: null, measure: null, parentObjectiveId: null });
    const { result } = renderHook(() => useObjectiveCoach({ open: true, cycleId: "c1", surface: "Team", orgUnitId: "u1" }));
    expect(result.current.enabled).toBe(true);

    await act(async () => {
      await result.current.run({ title: "Grow internal mobility", description: null, measurement: null, parentObjectiveId: null });
    });

    expect(coachObjective).toHaveBeenCalledWith(
      "c1",
      expect.objectContaining({ surface: "Team", orgUnitId: "u1", title: "Grow internal mobility" }),
      expect.any(AbortSignal)
    );
    expect(result.current.state.kind).toBe("nothing");
  });

  it("is not offered while AI is unavailable", () => {
    capabilities.aiAssistance = false;
    const { result } = renderHook(() => useObjectiveCoach({ open: true, cycleId: "c1", surface: "Plan" }));
    expect(result.current.enabled).toBe(false);
  });

  it("hides for the session after a failure", async () => {
    coachObjective.mockRejectedValue(new Error("unavailable"));
    const { result } = renderHook(() => useObjectiveCoach({ open: true, cycleId: "c1", surface: "Plan" }));

    await act(async () => {
      await result.current.run({ title: "Improve onboarding", description: null, measurement: null, parentObjectiveId: null });
    });

    expect(result.current.state.kind).toBe("hidden");
    expect(result.current.enabled).toBe(false);
  });
});
