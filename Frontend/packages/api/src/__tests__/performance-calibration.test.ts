import { describe, expect, it, vi } from "vitest";
import { createPerformanceApi, performanceQueryKeys } from "../performance";
import { createReviewsApi } from "../performance-reviews";
import type { ApiClient } from "../types";

function client() {
  const calls = { get: vi.fn(async () => ({})), post: vi.fn(async () => ({})), put: vi.fn(async () => ({})), delete: vi.fn(async () => ({})) };
  return { calls, api: createPerformanceApi(calls as unknown as ApiClient), reviews: createReviewsApi(calls as unknown as ApiClient) };
}

describe("calibration views, review drafts and summary revision", () => {
  it("sends only the filters that are set", async () => {
    const { calls, api } = client();
    await api.getCalibrationPeople("r1", { manager: "m1", flagged: true, notDiscussed: false, q: "  rim " });
    expect(calls.get).toHaveBeenCalledWith("/performance/review-rounds/r1/calibration/people", {
      params: { manager: "m1", flagged: "true", q: "rim" },
      signal: undefined,
    });
    await api.getCalibrationNineBox("r1", {});
    expect(calls.get).toHaveBeenLastCalledWith("/performance/review-rounds/r1/calibration/nine-box", { params: undefined, signal: undefined });
  });

  it("reads one subject and the finalize preview", async () => {
    const { calls, api } = client();
    await api.getCalibrationSubject("r1", "v1");
    expect(calls.get).toHaveBeenCalledWith("/performance/review-rounds/r1/calibration/subjects/v1", { signal: undefined });
    await api.getCalibrationFinalizePreview("r1");
    expect(calls.get).toHaveBeenLastCalledWith("/performance/review-rounds/r1/calibration/finalize-preview", { signal: undefined });
  });

  it("keys each view and filter apart, under the session", () => {
    const people = performanceQueryKeys.calibrationView("r1", "people", { manager: "m1" });
    const session = performanceQueryKeys.calibration("r1");
    expect(people.slice(0, session.length)).toEqual(session);
    expect(people).not.toEqual(performanceQueryKeys.calibrationView("r1", "people", { manager: "m2" }));
    expect(people).not.toEqual(performanceQueryKeys.calibrationView("r1", "nine-box", { manager: "m1" }));
  });

  it("asks for a draft without saving and revises a summary with its version", async () => {
    const { calls, reviews } = client();
    await reviews.draft("v1", "Question", "q1");
    expect(calls.post).toHaveBeenCalledWith("/performance/reviews/v1/draft", { kind: "Question", questionId: "q1" });
    await reviews.reviseSummary("v1", "New words.", 7);
    expect(calls.put).toHaveBeenCalledWith("/performance/reviews/v1/manager-summary", { summary: "New words.", expectedVersion: 7 });
    await reviews.markSummaryChecked("v1");
    expect(calls.post).toHaveBeenLastCalledWith("/performance/reviews/v1/summary-checked", {});
  });
});
