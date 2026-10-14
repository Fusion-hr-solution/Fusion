// @vitest-environment happy-dom
import { renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { useReviewAssessmentMutations } from "./use-reviews";

const { saveSelfAssessment } = vi.hoisted(() => ({ saveSelfAssessment: vi.fn() }));

vi.mock("@repo/api/query", () => ({
  useApiMutation: (fn: (args: unknown) => unknown) => ({ mutateAsync: fn }),
  useApiQuery: vi.fn(),
  useApiQueryClient: () => ({ invalidateQueries: vi.fn() }),
}));
vi.mock("./use-performance", () => ({
  useApis: () => ({ performance: { saveSelfAssessment } }),
}));
vi.mock("./performance-failure", () => ({ recoverPerformanceFailure: vi.fn() }));

describe("review assessment mutations", () => {
  it("sends the version from the rendered review", async () => {
    const { result } = renderHook(() => useReviewAssessmentMutations("review-1", "cycle-1"));
    const request = { summary: "My reflection", items: [], expectedVersion: 17 };

    await result.current.saveSelf.mutateAsync(request);

    expect(saveSelfAssessment).toHaveBeenCalledWith("review-1", request);
  });
});
