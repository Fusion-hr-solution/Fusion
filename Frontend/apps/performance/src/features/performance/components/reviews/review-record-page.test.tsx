// @vitest-environment happy-dom
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { PerformanceReviewDto } from "@repo/api";
import { ReviewRecordPage } from "./review-record-page";

const mocks = vi.hoisted(() => ({
  record: null as PerformanceReviewDto | null,
  saveSelf: vi.fn(), submitSelf: vi.fn(), saveManager: vi.fn(), submitManager: vi.fn(),
}));
vi.mock("next/navigation", () => ({ useParams: () => ({ reviewId: "review-1" }) }));
vi.mock("sonner", () => ({ toast: { success: vi.fn() } }));
vi.mock("@repo/ds/components/ui/textarea", async () => {
  const React = await import("react");
  return { Textarea: (props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) => React.createElement("textarea", props) };
});
vi.mock("@repo/ds/shell", async () => {
  const React = await import("react");
  return {
    AsyncButton: ({ children, onClick, disabled }: React.ButtonHTMLAttributes<HTMLButtonElement>) => React.createElement("button", { onClick, disabled }, children),
    PageContainer: ({ children }: React.PropsWithChildren) => React.createElement("main", null, children),
    PagePermissionNotice: ({ title, description }: { title: string; description: string }) => React.createElement("div", null, title, description),
    PageSkeleton: () => React.createElement("div", null, "Loading"),
    StatusBadge: ({ children }: React.PropsWithChildren) => React.createElement("span", null, children),
  };
});
vi.mock("../performance-page-heading", async () => {
  const React = await import("react");
  return { PerformancePageHeading: ({ title }: { title: string }) => React.createElement("h1", null, title) };
});
vi.mock("../content-unavailable", async () => {
  const React = await import("react");
  return { ContentUnavailable: () => React.createElement("div", null, "Unavailable") };
});
vi.mock("../../api/use-workspace", () => ({
  RecordCycleScope: ({ children }: React.PropsWithChildren) => children,
  useWorkspaceContext: () => ({ data: { selected: { id: "cycle-1" } }, isLoading: false, error: null, refetch: vi.fn() }),
}));
vi.mock("../../api/use-reviews", () => ({
  useReview: () => ({ data: mocks.record, isLoading: false, error: null, refetch: vi.fn() }),
  useReviewAssessmentMutations: () => ({
    saveSelf: { mutateAsync: mocks.saveSelf, isLoading: false, error: null },
    submitSelf: { mutateAsync: mocks.submitSelf, isLoading: false, error: null },
    saveManager: { mutateAsync: mocks.saveManager, isLoading: false, error: null },
    submitManager: { mutateAsync: mocks.submitManager, isLoading: false, error: null },
  }),
}));

const item = {
  kind: "Competency" as const, itemId: "comp-1", title: "Clear communication", description: "Shares context.",
  behaviors: [], measurement: null, hasProgress: false, progress: null, evidenceCount: 0, evidenceSummary: [],
  selfReflection: null, selfRating: null, selfComment: null, managerAssessment: null, managerRating: null,
};
function review(overrides: Partial<PerformanceReviewDto>): PerformanceReviewDto {
  return {
    id: "review-1", reviewRoundId: "round-1", cycleId: "cycle-1", reviewRoundName: "Annual review",
    periodStart: "2026-01-01", periodEnd: "2026-12-31", subjectDisplayName: "Taylor", reviewerDisplayName: "Morgan",
    state: "SelfAssessment", dueDate: null, selfAssessmentEnabled: true, calibrationEnabled: false,
    canEditSelfAssessment: true, canEditManagerAssessment: false, version: 2,
    ratingScaleVersionId: "scale-version-1", ratingScaleVersion: 1,
    ratingScale: [{ value: 1, label: "Developing", description: null }, { value: 2, label: "Strong", description: null }],
    selfAssessment: { summary: "", overallRating: null, savedAt: null, submittedAt: null }, managerAssessment: null,
    hasApprovedPlan: true, objectiveRatingsEnabled: false, items: [item], finalRating: null, finalRatingSource: null, finalizedAt: null, calibration: null, ...overrides,
  };
}
beforeEach(() => {
  vi.clearAllMocks();
  mocks.record = review({});
  mocks.saveSelf.mockResolvedValue(undefined);
  mocks.submitSelf.mockResolvedValue(undefined);
  mocks.saveManager.mockResolvedValue(undefined);
  mocks.submitManager.mockResolvedValue(undefined);
});

describe("review record item assessments", () => {
  it("shows only the final rating in the released subject result", () => {
    mocks.record = review({
      state: "Finalized", canEditSelfAssessment: false, canEditManagerAssessment: false,
      managerAssessment: { summary: "Strong contribution", overallRating: null, savedAt: "2026-10-01", submittedAt: "2026-10-02" },
      finalRating: 3, finalRatingSource: null,
      ratingScale: [{ value: 3, label: "Effective", description: null }],
    });
    render(<ReviewRecordPage />);
    expect(screen.getByText("Final rating")).toBeTruthy();
    expect(screen.getByText("Effective")).toBeTruthy();
    expect(screen.queryByText("Overall rating")).toBeNull();
    expect(screen.queryByText("Strong")).toBeNull();
  });

  it("submits self reflection and competency rating", async () => {
    render(<ReviewRecordPage />);
    fireEvent.change(screen.getByLabelText("Clear communication self reflection"), { target: { value: "I shared weekly updates." } });
    fireEvent.click(screen.getByRole("radio", { name: "Strong" }));
    fireEvent.change(screen.getByLabelText("Summary"), { target: { value: "Good year." } });
    fireEvent.click(screen.getByRole("button", { name: "Submit" }));
    await waitFor(() => expect(mocks.submitSelf).toHaveBeenCalledWith(expect.objectContaining({
      summary: "Good year.", items: [expect.objectContaining({ kind: "Competency", itemId: "comp-1", reflection: "I shared weekly updates.", rating: 2 })],
    })));
  });

  it("shows subject responses while the reviewer adds an item assessment", async () => {
    mocks.record = review({
      state: "ManagerAssessment", canEditSelfAssessment: false, canEditManagerAssessment: true,
      selfAssessment: { summary: "My reflection", overallRating: null, savedAt: "2026-10-01", submittedAt: "2026-10-02" },
      managerAssessment: { summary: "", overallRating: 2, savedAt: null, submittedAt: null },
      items: [{ ...item, selfReflection: "I shared weekly updates.", selfRating: 2 }],
    });
    render(<ReviewRecordPage />);
    expect(screen.getByText("I shared weekly updates.")).toBeTruthy();
    fireEvent.change(screen.getByLabelText("Clear communication reviewer assessment"), { target: { value: "Communicates clearly." } });
    fireEvent.click(screen.getAllByRole("radio", { name: "Strong" }).at(-1)!);
    fireEvent.change(screen.getByLabelText("Summary"), { target: { value: "Good performance." } });
    fireEvent.click(screen.getAllByRole("radio", { name: "Strong" })[0]!);
    fireEvent.click(screen.getByRole("button", { name: "Submit" }));
    await waitFor(() => expect(mocks.submitManager).toHaveBeenCalledWith(expect.objectContaining({
      items: [expect.objectContaining({ kind: "Competency", itemId: "comp-1", assessment: "Communicates clearly.", rating: 2 })],
    })));
  });
});
