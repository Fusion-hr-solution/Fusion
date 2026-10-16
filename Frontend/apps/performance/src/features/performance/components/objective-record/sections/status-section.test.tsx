// @vitest-environment happy-dom
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { ObjectiveStatusDto } from "@repo/api";
import type { ObjectiveRecord } from "../objective-record-model";
import { StatusSection } from "./status-section";

const acknowledge = vi.hoisted(() => ({ mutateAsync: vi.fn(async () => ({})), isLoading: false }));
vi.mock("../../../api/use-performance", () => ({ useAcknowledgeStatus: () => acknowledge }));
vi.mock("@/features/performance/api/performance-failure", () => ({ reportPerformanceFailure: vi.fn() }));

function record(status: ObjectiveStatusDto | null, canAcknowledgeStatus = false): ObjectiveRecord {
  return {
    ref: { cycleId: "c1", objectiveId: "o1" },
    source: { status, canAcknowledgeStatus, node: { version: 7 } },
  } as unknown as ObjectiveRecord;
}

const atRisk: ObjectiveStatusDto = {
  value: "AtRisk",
  reason: "The vendor moved its sandbox to 4 November.",
  reportedAt: "2026-10-02T09:00:00Z",
  since: "2026-10-02T09:00:00Z",
  acknowledgedAt: null,
  acknowledgedBy: null,
};

describe("StatusSection", () => {
  it("shows the owner's status with its reason", () => {
    render(<StatusSection record={record(atRisk)} />);
    expect(screen.getByText("At risk")).toBeTruthy();
    expect(screen.getByText("What's in the way")).toBeTruthy();
    expect(screen.getByText(atRisk.reason!)).toBeTruthy();
    expect(screen.queryByRole("button", { name: /Acknowledge/ })).toBeNull();
  });

  it("lets the responsible reviewer acknowledge with the objective's version", () => {
    render(<StatusSection record={record(atRisk, true)} />);
    fireEvent.click(screen.getByRole("button", { name: /Acknowledge/ }));
    expect(acknowledge.mutateAsync).toHaveBeenCalledWith(7);
  });

  it("shows who acknowledged it", () => {
    render(<StatusSection record={record({ ...atRisk, acknowledgedAt: "2026-10-03T09:00:00Z", acknowledgedBy: { id: "k", name: "Karim Haddad" } })} />);
    expect(screen.getByText("Karim Haddad")).toBeTruthy();
    expect(screen.getByText(/Acknowledged by/)).toBeTruthy();
  });

  it("renders nothing before the first report or without detail access", () => {
    const { container } = render(<StatusSection record={record(null)} />);
    expect(container.textContent).toBe("");
  });
});
