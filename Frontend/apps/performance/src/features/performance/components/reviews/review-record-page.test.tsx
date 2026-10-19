// @vitest-environment happy-dom
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { PerformanceReviewDto } from "@repo/api";
import { ReviewRecordPage } from "./review-record-page";

const mocks = vi.hoisted(() => ({
  record: null as PerformanceReviewDto | null,
  saveSelf: vi.fn(), submitSelf: vi.fn(), saveManager: vi.fn(), submitManager: vi.fn(), close: vi.fn(),
  acknowledge: vi.fn(), moveReview: vi.fn(),
}));
vi.mock("next/navigation", () => ({ useParams: () => ({ reviewId: "review-1" }) }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock("@repo/ds/shell", async () => {
  const React = await import("react");
  return {
    AsyncButton: ({ children, onClick, disabled }: React.ButtonHTMLAttributes<HTMLButtonElement>) => React.createElement("button", { onClick, disabled }, children),
    PageContainer: ({ children }: React.PropsWithChildren) => React.createElement("main", null, children),
    PagePermissionNotice: ({ title }: { title: string }) => React.createElement("div", null, title),
    PageSkeleton: () => React.createElement("div", null, "Loading"),
    StatusBadge: ({ children }: React.PropsWithChildren) => React.createElement("span", null, children),
  };
});
vi.mock("../performance-page-heading", async () => {
  const React = await import("react");
  return {
    PerformancePageHeading: ({ title, actions }: { title: React.ReactNode; actions?: React.ReactNode }) =>
      React.createElement("header", null, React.createElement("h1", null, title), actions),
  };
});
vi.mock("../content-unavailable", async () => {
  const React = await import("react");
  return { ContentUnavailable: () => React.createElement("div", null, "Unavailable") };
});
vi.mock("../conversations/colleague-picker", () => ({ ColleaguePicker: () => null }));
vi.mock("@repo/performance-ui", async (original) => {
  const React = await import("react");
  return { ...(await original<object>()), ValueChip: ({ value }: { value: { name: string } }) => React.createElement("span", null, value.name) };
});
vi.mock("../../api/use-workspace", () => ({
  RecordCycleScope: ({ children }: React.PropsWithChildren) => children,
  useWorkspaceContext: () => ({ data: { selected: { id: "cycle-1" } }, isLoading: false, error: null, refetch: vi.fn() }),
}));
vi.mock("../../api/use-reviews", () => ({
  useReview: () => ({ data: mocks.record, isLoading: false, error: null, refetch: vi.fn() }),
  useReviewAssessmentMutations: () => ({
    saveSelf: { mutateAsync: mocks.saveSelf, isLoading: false },
    submitSelf: { mutateAsync: mocks.submitSelf, isLoading: false },
    saveManager: { mutateAsync: mocks.saveManager, isLoading: false },
    submitManager: { mutateAsync: mocks.submitManager, isLoading: false },
    close: { mutateAsync: mocks.close, isLoading: false },
  }),
}));
vi.mock("../../api/use-review-work", () => ({
  useAcknowledge: () => ({ mutateAsync: mocks.acknowledge, isLoading: false }),
  useDownloadReviewPdf: () => vi.fn(),
  usePeerCommands: () => ({ nominate: { mutateAsync: vi.fn(), isLoading: false } }),
  useScheduleCommands: () => ({ moveReview: { mutateAsync: mocks.moveReview, isLoading: false } }),
}));

const scale = [1, 2, 3, 4, 5].map((value) => ({ value, label: ["Below", "Developing", "Meets", "Exceeds", "Outstanding"][value - 1]!, description: null }));
const competency = {
  kind: "Competency" as const, itemId: "comp-1", title: "Ownership", description: "Owns outcomes.",
  behaviors: [], measurement: null, hasProgress: false, progress: null, evidenceCount: 0, evidenceSummary: [],
  selfReflection: null, selfRating: null, selfComment: null, managerAssessment: null, managerRating: null,
};
function review(overrides: Partial<PerformanceReviewDto>): PerformanceReviewDto {
  return {
    id: "review-1", reviewRoundId: "round-1", cycleId: "cycle-1", reviewRoundName: "Year-end review",
    periodStart: "2026-10-01", periodEnd: "2027-08-31", subjectDisplayName: "Aicha Bouazizi", reviewerDisplayName: "Mariam Gharbi",
    state: "SelfAssessment", dueDate: "2099-09-15", selfAssessmentEnabled: true, calibrationEnabled: false,
    canEditSelfAssessment: true, canEditManagerAssessment: false, version: 2,
    ratingScaleVersionId: "scale-version-1", ratingScaleVersion: 1, ratingScale: scale,
    selfAssessment: { summary: "", overallRating: null, savedAt: null, submittedAt: null }, managerAssessment: null,
    hasApprovedPlan: true, objectiveRatingsEnabled: true, items: [competency], finalRating: null, finalRatingSource: null, finalizedAt: null, calibration: null,
    lens: "Subject", subjectEmployeeId: "aicha", reviewerEmployeeId: "mariam", subjectJobTitle: "QA Automation Engineer", subjectOrgUnitName: "Product A",
    roundState: "Active", peerInputEnabled: false, questionsEnabled: true, potentialEnabled: false,
    questions: [
      { questionId: "q-person", audience: "Person", sortOrder: 0, text: "What are you most proud of this year?", selfAnswer: null, managerAnswer: null },
      { questionId: "q-manager", audience: "Manager", sortOrder: 0, text: "What should they keep doing?", selfAnswer: null, managerAnswer: null },
    ],
    potential: null, peers: null, acknowledgement: null,
    schedule: { selfAssessmentDue: "2099-09-15", peerInputDue: null, managerAssessmentDue: "2099-09-22", daysLate: 0, selfOverridden: false, managerOverridden: false, nextReminder: null, remindersSent: [] },
    year: null, activity: [], closeReason: null,
    canAcknowledge: false, canDownloadPdf: false, canNominatePeers: false, canApprovePeers: false, canMoveDueDate: false, canClose: false,
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.record = review({});
  for (const fn of [mocks.saveSelf, mocks.submitSelf, mocks.saveManager, mocks.submitManager]) fn.mockResolvedValue({ id: "review-1", state: "ManagerAssessment", dueDate: null, version: 3 });
  mocks.acknowledge.mockResolvedValue({ at: "2099-09-29T10:00:00Z", comment: null });
});

describe("the person writing (board 08)", () => {
  it("submits ratings, the answer, the overall view and the summary", async () => {
    render(<ReviewRecordPage />);
    expect(screen.queryByText("What should they keep doing?")).toBeNull();
    fireEvent.click(screen.getAllByRole("radio", { name: "4 Exceeds" })[0]!);
    fireEvent.change(screen.getByLabelText("What are you most proud of this year?"), { target: { value: "The nightly suite." } });
    fireEvent.click(screen.getAllByRole("radio").find((r) => r.textContent?.startsWith("4") && r.textContent.includes("Exceeds"))!);
    fireEvent.change(screen.getByLabelText("Your summary"), { target: { value: "A steady year." } });
    fireEvent.click(screen.getByRole("button", { name: /Submit self-assessment/ }));
    await waitFor(() => expect(mocks.submitSelf).toHaveBeenCalledWith(expect.objectContaining({
      summary: "A steady year.", overallRating: 4,
      answers: [{ questionId: "q-person", text: "The nightly suite." }],
      items: [expect.objectContaining({ kind: "Competency", itemId: "comp-1", rating: 4 })],
    })));
  });
});

describe("the released result (board 13)", () => {
  it("leads with the result, never shows potential, and acknowledges with a comment", async () => {
    mocks.record = review({
      state: "Finalized", canEditSelfAssessment: false, finalRating: 4, finalizedAt: "2099-09-28T10:00:00Z",
      managerAssessment: { summary: "Testing became something the team relies on.", overallRating: null, savedAt: null, submittedAt: "2099-09-20T10:00:00Z" },
      canAcknowledge: true, canDownloadPdf: true,
    });
    render(<ReviewRecordPage />);
    expect(screen.getByRole("heading", { name: "Exceeds" })).toBeTruthy();
    expect(screen.getByText("Testing became something the team relies on.")).toBeTruthy();
    expect(screen.queryByText("Potential")).toBeNull();
    fireEvent.change(screen.getByLabelText("Comment for your reviewer and HR"), { target: { value: "Agreed." } });
    fireEvent.click(screen.getByRole("button", { name: /Acknowledge/ }));
    await waitFor(() => expect(mocks.acknowledge).toHaveBeenCalledWith("Agreed."));
  });
});

describe("the reviewer (board 12)", () => {
  it("writes beside the person's words and submits potential with the review", async () => {
    mocks.record = review({
      lens: "Reviewer", state: "ManagerAssessment", canEditSelfAssessment: false, canEditManagerAssessment: true, potentialEnabled: true,
      selfAssessment: { summary: "My year", overallRating: 4, savedAt: null, submittedAt: "2099-09-08T10:00:00Z" },
      managerAssessment: { summary: "", overallRating: null, savedAt: null, submittedAt: null },
      items: [{ ...competency, selfRating: 3 }],
      questions: [{ questionId: "q-manager", audience: "Manager", sortOrder: 0, text: "What should they keep doing?", selfAnswer: null, managerAnswer: null }],
      peers: { approved: true, approvedAt: null, nominatedAt: null, questions: ["What do they do well?"], people: [
        { employeeId: "fares", displayName: "Fares Lachheb", source: "Subject", requestId: "p1", state: "Answered", declineNote: null, respondedAt: null,
          answers: [{ questionId: "pq", question: "What do they do well?", text: "Turns bug reports into tests." }] },
        { employeeId: "khaled", displayName: "Khaled Sassi", source: "Subject", requestId: "p2", state: "Declined", declineNote: "Haven't worked together", respondedAt: null, answers: [] },
      ] },
    });
    render(<ReviewRecordPage />);
    expect(screen.getByText("Turns bug reports into tests.")).toBeTruthy();
    expect(screen.getByText(/Haven't worked together/)).toBeTruthy();
    fireEvent.click(screen.getAllByRole("radio", { name: "5 Outstanding" })[0]!);
    fireEvent.change(screen.getByLabelText("What should they keep doing?"), { target: { value: "Pairing." } });
    fireEvent.change(screen.getByLabelText("Your summary"), { target: { value: "Raised the bar." } });
    fireEvent.click(screen.getAllByRole("radio").find((r) => r.textContent?.startsWith("4") && r.textContent.includes("Exceeds"))!);
    fireEvent.click(screen.getByRole("radio", { name: /High/ }));
    fireEvent.click(screen.getByRole("button", { name: /Submit review/ }));
    await waitFor(() => expect(mocks.submitManager).toHaveBeenCalledWith(expect.objectContaining({
      summary: "Raised the bar.", overallRating: 4, potential: "High",
      answers: [{ questionId: "q-manager", text: "Pairing." }],
      items: [expect.objectContaining({ kind: "Competency", rating: 5 })],
    })));
  });
});

describe("HR's view (board 14)", () => {
  it("shows lateness, reminders and activity with the move and close actions", () => {
    mocks.record = review({
      lens: "Administrator", canEditSelfAssessment: false, canMoveDueDate: true, canClose: true,
      schedule: { selfAssessmentDue: "2020-09-15", peerInputDue: null, managerAssessmentDue: "2020-09-22", daysLate: 2, selfOverridden: false, managerOverridden: false,
        nextReminder: "2020-09-23", remindersSent: ["2020-09-12T09:00:00Z", "2020-09-16T09:00:00Z"] },
      activity: [{ kind: "Opened", at: "2020-09-01T09:00:00Z", text: "Review opened", detail: null }],
    });
    render(<ReviewRecordPage />);
    expect(screen.getByText("Self-assessment 2 days late")).toBeTruthy();
    expect(screen.getByText("Review opened")).toBeTruthy();
    expect(screen.getByRole("button", { name: /Move due date/ })).toBeTruthy();
    expect(screen.getByRole("button", { name: /Close without a result/ })).toBeTruthy();
  });
});
