import { describe, expect, it, vi } from "vitest";
import { createPerformanceApi, performanceQueryKeys } from "../performance";
import type { ApiClient } from "../types";

function client() {
  const calls = { get: vi.fn(async () => ({})), post: vi.fn(async () => ({})), put: vi.fn(async () => ({})), delete: vi.fn(async () => ({})) };
  return { calls, api: createPerformanceApi(calls as unknown as ApiClient) };
}

describe("objective coach and alignment map contracts", () => {
  it("asks the coach about a draft without saving it", async () => {
    const { calls, api } = client();
    const signal = new AbortController().signal;
    const draft = { surface: "Team" as const, orgUnitId: "u1", title: "Improve onboarding", measurement: { method: "ManualPercentage" as const } };
    await api.coachObjective("c1", draft, signal);
    expect(calls.post).toHaveBeenCalledWith("/performance/cycles/c1/objective-coach", draft, { signal });
  });

  it("reads the cycle's alignment map", async () => {
    const { calls, api } = client();
    await api.getAlignmentMap("c1");
    expect(calls.get).toHaveBeenCalledWith("/performance/cycles/c1/goals/map", { signal: undefined });
  });

  it("keys the map per cycle, apart from the goals list", () => {
    expect(performanceQueryKeys.alignmentMap("c1")).not.toEqual(performanceQueryKeys.alignmentMap("c2"));
    expect(performanceQueryKeys.alignmentMap("c1")).not.toEqual(performanceQueryKeys.goals("c1"));
  });
});
