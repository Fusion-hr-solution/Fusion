// @vitest-environment happy-dom
import { act, fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { ObjectiveProgressDto } from "@repo/api";
import { ProgressUpdateComposer } from "./progress-update-composer";

vi.mock("@/features/performance/api/performance-failure", () => ({ reportPerformanceFailure: vi.fn() }));

function progress(overrides: Partial<ObjectiveProgressDto> = {}): ObjectiveProgressDto {
  return {
    version: 3,
    objectiveId: "o1",
    title: "Integrate the vendor API",
    ownershipScope: "Employee",
    method: "WeightedMilestones",
    hasProgress: true,
    derivedProgress: 40,
    currentPercentage: null,
    currentActual: null,
    baseline: null,
    target: null,
    unit: null,
    direction: null,
    milestones: [
      { id: "m1", title: "Sandbox contract signed", weight: 40, dueDate: null, isCompleted: true },
      { id: "m2", title: "Refunds flow", weight: 30, dueDate: null, isCompleted: false },
      { id: "m3", title: "Cut-over", weight: 30, dueDate: null, isCompleted: false },
    ],
    canUpdate: true,
    history: [],
    historyNextCursor: null,
    currentStatus: null,
    ...overrides,
  };
}

function setup(dto: ObjectiveProgressDto) {
  const onSubmit = vi.fn(async () => undefined);
  const onValidityChange = vi.fn();
  render(
    <ProgressUpdateComposer
      progress={dto}
      submitting={false}
      formId="f"
      onSubmit={onSubmit}
      upload={vi.fn()}
      onValidityChange={onValidityChange}
      onRecorded={vi.fn()}
    />,
  );
  const lastValidity = () => onValidityChange.mock.calls.at(-1)?.[0];
  const submit = async () => {
    await act(async () => {
      fireEvent.submit(document.getElementById("f")!);
    });
  };
  return { onSubmit, lastValidity, submit };
}

describe("ProgressUpdateComposer", () => {
  it("waits for a status on the first check-in", () => {
    const { lastValidity } = setup(progress());
    expect(lastValidity()).toBe(false);
    fireEvent.click(screen.getByRole("radio", { name: "On track" }));
    expect(lastValidity()).toBe(true);
  });

  it("preselects the last reported status", () => {
    setup(progress({ currentStatus: "AtRisk" }));
    expect(screen.getByRole("radio", { name: "At risk" }).getAttribute("aria-checked")).toBe("true");
    expect(screen.getByLabelText("What's in the way")).toBeTruthy();
  });

  it("requires the reason only at risk or off track", () => {
    const { lastValidity } = setup(progress({ currentStatus: "OnTrack" }));
    expect(lastValidity()).toBe(true);
    fireEvent.click(screen.getByRole("radio", { name: "Off track" }));
    expect(lastValidity()).toBe(false);
    fireEvent.change(screen.getByLabelText("What's in the way"), { target: { value: "Vendor sandbox moved" } });
    expect(lastValidity()).toBe(true);
  });

  it("records several milestones as one check-in", async () => {
    const { onSubmit, submit } = setup(progress({ currentStatus: "OnTrack" }));
    fireEvent.click(screen.getAllByRole("checkbox")[1]!);
    fireEvent.click(screen.getAllByRole("checkbox")[2]!);
    expect(screen.getAllByText("New")).toHaveLength(2);
    expect(screen.getByText("was 1 of 3")).toBeTruthy();
    await submit();
    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({
      milestones: [{ milestoneId: "m2", completed: true }, { milestoneId: "m3", completed: true }],
      status: "OnTrack",
      isCorrection: false,
    }));
  });

  it("asks for a note when reopening a milestone", () => {
    const { lastValidity } = setup(progress({ currentStatus: "OnTrack" }));
    fireEvent.click(screen.getAllByRole("checkbox")[0]!);
    expect(screen.getByText("Reopened")).toBeTruthy();
    expect(lastValidity()).toBe(false);
  });

  it("reports status alone when nothing else changes", async () => {
    const { onSubmit, submit } = setup(progress({ method: "ManualPercentage", milestones: [], currentPercentage: 40, currentStatus: "OnTrack" }));
    fireEvent.click(screen.getByRole("radio", { name: "At risk" }));
    fireEvent.change(screen.getByLabelText("What's in the way"), { target: { value: "Waiting on legal" } });
    await submit();
    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({
      percentage: null,
      numericActual: null,
      milestones: null,
      status: "AtRisk",
      contextNote: "Waiting on legal",
    }));
  });
});
