// @vitest-environment happy-dom
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import React from "react";
import { describe, expect, it, vi } from "vitest";
import type { CalibrationSessionDto } from "@repo/api";
import { CalibrationWorkspace } from "./calibration-workspace";

vi.mock("next/link", async () => {
  const React = await import("react");
  return { default: ({ href, children, ...rest }: React.PropsWithChildren<{ href: string }>) => React.createElement("a", { href, ...rest }, children) };
});
vi.mock("sonner", () => ({ toast: { success: vi.fn() } }));
vi.mock("../../api/use-reviews", () => ({ useReview: () => ({ data: undefined, isLoading: false }) }));
vi.mock("../../api/use-calibration", () => ({ useFacilitatorCandidates: () => ({ data: [], isLoading: false, error: null }) }));
vi.mock("../../api/use-workspace", () => ({ useWorkspaceContext: () => ({ data: undefined }) }));

const scale = [
  { value: 1, label: "Needs improvement", description: null },
  { value: 2, label: "Developing", description: null },
  { value: 3, label: "Effective", description: null },
  { value: 4, label: "Strong", description: null },
];

const session: CalibrationSessionDto = {
  id: "s1", reviewRoundId: "round-1", cycleId: "cycle-1", reviewRoundName: "Year-end 2026", state: "Open", version: 7,
  openedAt: "2026-10-01T09:00:00Z", finalizedAt: null,
  facilitators: [{ userId: "u1", displayName: "QA Admin", namedAt: "2026-10-01T09:00:00Z" }],
  counts: { subjects: 1, discussed: 0, adjusted: 0, remaining: 1, outstanding: 0 },
  ratingScale: scale,
  distribution: scale.map((level) => ({ value: level.value, label: level.label, original: level.value === 4 ? 1 : 0, current: level.value === 4 ? 1 : 0 })),
  subjects: [{
    reviewId: "review-1", subjectDisplayName: "Youssef Ben Salah", reviewerDisplayName: "Rania Mansour", orgUnitName: "People Operations",
    jobTitle: "Analyst", reviewState: "Calibration", originalRating: 4, calibratedRating: null, currentRating: 4, adjusted: false,
    rationale: null, discussionState: "NotDiscussed", version: 3, history: [],
  }],
  outstanding: [],
};

function mutation() {
  return { mutateAsync: vi.fn().mockResolvedValue(undefined), isLoading: false, error: null };
}

describe("calibration workspace keyboard operation", () => {
  it("selects a person, lowers the rating with arrows, explains it, marks it discussed and saves without a pointer", async () => {
    const mutations = { open: mutation(), setFacilitators: mutation(), adjust: mutation(), finalize: mutation() };
    render(<CalibrationWorkspace session={session} roundId="round-1" mutations={mutations as never} />);

    const row = screen.getByText("Youssef Ben Salah").closest("tr")!;
    row.focus();
    fireEvent.keyDown(row, { key: "Enter" });

    const group = await screen.findByRole("radiogroup", { name: "Calibrated rating" });
    const current = within(group).getByRole("radio", { checked: true });
    expect(current.textContent).toContain("Strong");
    expect(current.tabIndex).toBe(0);
    fireEvent.keyDown(current, { key: "ArrowLeft" });
    const effective = within(group).getByRole("radio", { name: /Effective/ });
    expect(effective.getAttribute("aria-checked")).toBe("true");
    expect(document.activeElement).toBe(effective);

    const save = screen.getByRole("button", { name: "Save calibration" });
    expect((save as HTMLButtonElement).disabled).toBe(true);
    fireEvent.change(screen.getByLabelText("Rationale"), { target: { value: "Outcomes trailed peers at this level." } });
    fireEvent.click(screen.getByRole("button", { name: "Discussed" }));
    expect(screen.getByRole("button", { name: "Discussed" }).getAttribute("aria-pressed")).toBe("true");
    fireEvent.click(save);

    await waitFor(() => expect(mutations.adjust.mutateAsync).toHaveBeenCalledWith({
      reviewId: "review-1", rating: 3, rationale: "Outcomes trailed peers at this level.", discussionState: "Discussed", expectedVersion: 3,
    }));
  });

  it("holds finalization while reviews are still in assessment", () => {
    const blocked = { ...session, outstanding: [{ reviewId: "r2", subjectDisplayName: "Salma Trabelsi", reviewerDisplayName: "Rania Mansour", state: "ManagerAssessment" as const }] };
    const mutations = { open: mutation(), setFacilitators: mutation(), adjust: mutation(), finalize: mutation() };
    render(<CalibrationWorkspace session={blocked} roundId="round-1" mutations={mutations as never} />);
    expect((screen.getByRole("button", { name: "Finalize calibration" }) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByText(/1 still in assessment/)).toBeTruthy();
  });
});
