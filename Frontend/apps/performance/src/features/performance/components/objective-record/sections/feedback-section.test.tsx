// @vitest-environment happy-dom
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { ObjectiveRecord } from "../objective-record-model";
import { FeedbackSection } from "./feedback-section";

const state = vi.hoisted(() => ({ items: [] as unknown[] }));
vi.mock("../../../api/use-conversations", () => ({
  useFeedbackList: () => ({ data: { items: state.items, next: null }, isLoading: false }),
  useFeedbackItem: () => ({ data: undefined, error: null }),
  useGiveFeedback: () => ({ mutateAsync: vi.fn(), isLoading: false, error: null }),
  useAskForFeedback: () => ({ mutateAsync: vi.fn(), isLoading: false, error: null }),
  useCompanyValues: () => ({ data: [] }),
  useDirectory: () => ({ data: [], isLoading: false, error: null }),
  useOneOnOnes: () => ({ data: undefined }),
  useOneOnOne: () => ({ data: undefined }),
  useOneOnOneCommands: () => ({ addAgendaItem: { mutateAsync: vi.fn(), isLoading: false } }),
  usePraiseItem: () => ({ data: undefined, error: null }),
  useDeletePraise: () => ({ mutateAsync: vi.fn(), isLoading: false }),
}));
vi.mock("@repo/auth", () => ({ useAuth: () => ({ user: { employeeId: "me" } }) }));
vi.mock("../../../api/use-performance", () => ({ usePersonSummary: () => ({ data: undefined, isLoading: false, error: null }) }));
vi.mock("@repo/api/query", () => ({ useReactToPraise: () => ({ mutate: vi.fn(), isLoading: false }), useCompanyValues: () => ({ data: [{ id: "v1", name: "Collaboration" }] }) }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }), useSearchParams: () => new URLSearchParams(), usePathname: () => "/" }));

function record(can: { give: boolean; ask: boolean }): ObjectiveRecord {
  return {
    ref: { cycleId: "c1", objectiveId: "o1" },
    title: "Integrate the vendor API",
    accountable: { id: "aicha", name: "Aicha Bouazizi" },
    source: { canGiveFeedback: can.give, canAskForFeedback: can.ask },
  } as unknown as ObjectiveRecord;
}

describe("objective record feedback", () => {
  it("offers the owner only Ask for feedback on this, with the objective fixed", () => {
    render(<FeedbackSection record={record({ give: false, ask: true })} />);
    expect(screen.queryByRole("button", { name: "Give feedback" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Ask for feedback on this" }));
    const dialog = screen.getByRole("dialog");
    expect(screen.getByLabelText("Your question")).toBeTruthy();
    expect(dialog.textContent).toContain("Integrate the vendor API");
    expect(screen.queryByRole("radiogroup", { name: "About" })).toBeNull();
  });

  it("offers a colleague only Give feedback, fixed to the owner and the objective", () => {
    render(<FeedbackSection record={record({ give: true, ask: false })} />);
    expect(screen.queryByRole("button", { name: "Ask for feedback on this" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Give feedback" }));
    const dialog = screen.getByRole("dialog");
    expect(dialog.textContent).toContain("Aicha Bouazizi");
    expect(dialog.textContent).toContain("Integrate the vendor API");
    expect(screen.getByRole("button", { name: "Send to Aicha" })).toBeTruthy();
    expect(screen.queryByLabelText("To")).toBeNull();
  });

  it("is absent when there is nothing to read and nothing to do", () => {
    const { container } = render(<FeedbackSection record={record({ give: false, ask: false })} />);
    expect(container.textContent).toBe("");
  });
});
