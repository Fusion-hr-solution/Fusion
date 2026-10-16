import { describe, expect, it, vi } from "vitest";
import { createPerformanceApi, performanceQueryKeys } from "../performance";
import type { ApiClient } from "../types";

function client() {
  const calls = { get: vi.fn(async () => ({})), post: vi.fn(async () => ({})), put: vi.fn(async () => ({})), delete: vi.fn(async () => ({})) };
  return { calls, api: createPerformanceApi(calls as unknown as ApiClient) };
}

describe("status, change requests and development contracts", () => {
  it("acknowledges an objective's status with its version", async () => {
    const { calls, api } = client();
    await api.acknowledgeObjectiveStatus("c1", "o1", 4);
    expect(calls.post).toHaveBeenCalledWith("/performance/cycles/c1/objectives/o1/status/acknowledge", { expectedVersion: 4 });
  });

  it("addresses a change request on the owner's plan", async () => {
    const { calls, api } = client();
    await api.addressChangeRequest("c1", "r1", { expectedVersion: 2, reply: "Done" });
    expect(calls.post).toHaveBeenCalledWith("/performance/cycles/c1/plan/change-requests/r1/address", { expectedVersion: 2, reply: "Done" });
  });

  it("reads and changes a person's development plan in a cycle", async () => {
    const { calls, api } = client();
    const input = { expectedVersion: 0, title: "Lead a review", competencyId: null, actions: [], targetDate: null, status: "NotStarted" as const };
    await api.getDevelopmentPlan("c1", "e1");
    await api.addDevelopmentGoal("c1", "e1", input);
    await api.updateDevelopmentGoal("c1", "e1", "g1", input);
    await api.removeDevelopmentGoal("c1", "e1", "g1", 3);
    await api.carryOverDevelopmentGoals("c1", "e1", ["g0"], 3);
    await api.dismissDevelopmentCarryOver("c1", "e1", 3);
    const base = "/performance/cycles/c1/people/e1/development";
    expect(calls.get).toHaveBeenCalledWith(base, { signal: undefined });
    expect(calls.post).toHaveBeenCalledWith(`${base}/goals`, input);
    expect(calls.put).toHaveBeenCalledWith(`${base}/goals/g1`, input);
    expect(calls.delete).toHaveBeenCalledWith(`${base}/goals/g1`, { body: { expectedVersion: 3 } });
    expect(calls.post).toHaveBeenCalledWith(`${base}/carry-over`, { goalIds: ["g0"], expectedVersion: 3 });
    expect(calls.post).toHaveBeenCalledWith(`${base}/carry-over/dismiss`, { expectedVersion: 3 });
  });

  it("keys development per cycle and person", () => {
    expect(performanceQueryKeys.development("c1", "e1")).not.toEqual(performanceQueryKeys.development("c2", "e1"));
  });
});
