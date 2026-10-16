// @vitest-environment happy-dom
import { act, fireEvent, render, renderHook, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { EmployeePlanDto, PlanChangeRequestDto } from "@repo/api";
import { ChangeRequestDraft, ChangeRequestOutcome, OwnerChangeRequest, useChangeRequestDrafts, useLeaveGuard } from "./change-requests";
import { ReviewDecision } from "./plan-review";

const review = vi.hoisted(() => ({
  returnForRevision: { mutateAsync: vi.fn(async () => ({})), isLoading: false },
  approve: { mutateAsync: vi.fn(async () => ({})), isLoading: false },
}));
vi.mock("../../api/use-performance", () => ({
  usePlanReviewMutations: () => review,
  usePlanDetail: vi.fn(),
  useAlignmentTargets: vi.fn(),
}));
vi.mock("../objective-record/use-objective-record", () => ({ useObjectiveRecord: () => ({ open: vi.fn(), isOpen: () => false }) }));
vi.mock("@/features/performance/api/performance-failure", () => ({ performanceFailure: () => ({}), reportPerformanceFailure: vi.fn() }));
vi.mock("sonner", () => ({ toast: { success: vi.fn() } }));

const request = (overrides: Partial<PlanChangeRequestDto> = {}): PlanChangeRequestDto => ({
  id: "r1", objectiveId: "o1", objectiveTitle: "Ship the gateway", text: "Make this measurable", state: "Addressed",
  reply: "Target is now 99.9% uptime", addressedAt: "2026-10-13T09:00:00Z", objectiveChanged: true, ...overrides,
});

describe("change requests", () => {
  it("drafts a change on an objective, then edits or removes it", () => {
    const onSave = vi.fn();
    const onRemove = vi.fn();
    const { rerender } = render(<ChangeRequestDraft value={undefined} onSave={onSave} onRemove={onRemove} />);
    fireEvent.click(screen.getByRole("button", { name: /Request a change/ }));
    fireEvent.change(screen.getByLabelText("What should change"), { target: { value: "Make this measurable" } });
    fireEvent.click(screen.getByRole("button", { name: "Save change" }));
    expect(onSave).toHaveBeenCalledWith("Make this measurable");
    rerender(<ChangeRequestDraft value="Make this measurable" onSave={onSave} onRemove={onRemove} />);
    fireEvent.click(screen.getByRole("button", { name: "Remove the change" }));
    expect(onRemove).toHaveBeenCalled();
  });

  it("counts the drafts on the Return action and sends them with the note", async () => {
    const { result } = renderHook(() => useChangeRequestDrafts());
    act(() => result.current.set("o1", "Make this measurable"));
    const plan = { version: 5, cycleName: "FY2027", objectives: [{ id: "o1", title: "Ship the gateway" }] } as unknown as EmployeePlanDto;
    render(<ReviewDecision plan={plan} cycleId="c1" planId="p1" firstName="Nour" drafts={result.current} />);
    fireEvent.click(screen.getByRole("button", { name: /Return with 1 change/ }));
    expect(screen.getByText("Ship the gateway")).toBeTruthy();
    await act(async () => {
      fireEvent.click(screen.getAllByRole("button", { name: /Return with 1 change/ }).at(-1)!);
    });
    expect(review.returnForRevision.mutateAsync).toHaveBeenCalledWith({
      feedback: null,
      changeRequests: [{ objectiveId: "o1", text: "Make this measurable" }],
      expectedVersion: 5,
    });
  });

  it("asks before leaving with unsent drafts", () => {
    const confirm = vi.fn(() => false);
    window.confirm = confirm;
    const { unmount } = renderHook(() => useLeaveGuard(true));
    const link = document.createElement("a");
    link.href = "/performance/team";
    document.body.appendChild(link);
    const event = new MouseEvent("click", { bubbles: true, cancelable: true });
    link.dispatchEvent(event);
    expect(confirm).toHaveBeenCalled();
    expect(event.defaultPrevented).toBe(true);
    unmount();
  });

  it("labels what came of each request", () => {
    const { rerender } = render(<ChangeRequestOutcome request={request()} />);
    expect(screen.getByText("Changed")).toBeTruthy();
    expect(screen.getByText("Target is now 99.9% uptime")).toBeTruthy();
    rerender(<ChangeRequestOutcome request={request({ objectiveChanged: false, reply: null })} />);
    expect(screen.getByText("Not changed")).toBeTruthy();
    rerender(<ChangeRequestOutcome request={request({ state: "ObjectiveRemoved", objectiveChanged: null })} />);
    expect(screen.getByText("Objective removed")).toBeTruthy();
  });

  it("lets the owner mark a request addressed with a reply", async () => {
    const onAddress = vi.fn(async () => true);
    render(<OwnerChangeRequest request={request({ state: "Open", reply: null })} reviewerName="Karim Haddad" decidedAt="2026-10-12T09:00:00Z" canAddress onAddress={onAddress} />);
    expect(screen.getByText("Karim Haddad asked for a change")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /Mark addressed/ }));
    fireEvent.change(screen.getByLabelText(/Reply/), { target: { value: "Done" } });
    await act(async () => {
      fireEvent.click(screen.getAllByRole("button", { name: /Mark addressed/ }).at(-1)!);
    });
    expect(onAddress).toHaveBeenCalledWith("Done");
  });
});
