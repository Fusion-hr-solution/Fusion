import { describe, expect, it, vi } from "vitest";
import { createPerformanceApi, performancePaths, performanceQueryKeys } from "../performance";
import type { ApiClient } from "../types";

describe("person summary contract", () => {
  it("reads the summary for the default cycle", async () => {
    const get = vi.fn(async () => ({}));
    const api = createPerformanceApi({ get } as unknown as ApiClient);
    await api.getPersonSummary("employee-1");
    expect(get).toHaveBeenCalledWith("/performance/people/employee-1/summary", {
      params: { cycleId: undefined },
      signal: undefined,
    });
  });

  it("reads the summary for an explicit cycle", async () => {
    const get = vi.fn(async () => ({}));
    const api = createPerformanceApi({ get } as unknown as ApiClient);
    await api.getPersonSummary("employee-1", "cycle-1");
    expect(get).toHaveBeenCalledWith(performancePaths.personSummary("employee-1"), {
      params: { cycleId: "cycle-1" },
      signal: undefined,
    });
  });

  it("keys the default and an explicit cycle apart", () => {
    expect(performanceQueryKeys.personSummary("e")).not.toEqual(performanceQueryKeys.personSummary("e", "c"));
  });
});
