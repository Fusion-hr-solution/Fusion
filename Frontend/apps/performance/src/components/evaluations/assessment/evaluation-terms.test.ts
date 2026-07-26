import { describe, expect, it } from "vitest";
import type { TeamQueueItemDto } from "@repo/api";
import {
  assessmentModelLabel,
  evaluationStateLabel,
  evaluationStateTone,
  gapStateLabel,
  gapStateTone,
  queueGroupFor,
  roundTypeLabel,
} from "./evaluation-terms";

function queueItem(overrides: Partial<TeamQueueItemDto>): TeamQueueItemDto {
  return {
    participantEmployeeId: "p",
    participantName: "Person",
    selfAssignmentId: null,
    managerAssignmentId: "m",
    status: "InProgress",
    actionable: true,
    selfSubmitted: false,
    selfMissing: false,
    materialDifferenceCount: 0,
    deadline: null,
    finalizedAt: null,
    acknowledgedAt: null,
    nextAction: "",
    ...overrides,
  };
}

describe("evaluation-terms", () => {
  it("maps every known status to a human label, never echoing a raw enum", () => {
    for (const status of [
      "NotStarted",
      "InProgress",
      "Submitted",
      "Finalized",
      "Acknowledged",
      "AwaitingManager",
      "Not started",
      "In progress",
    ]) {
      const label = evaluationStateLabel(status);
      expect(label).not.toMatch(/[a-z][A-Z]/); // no camelCase leaked through
      expect(label.length).toBeGreaterThan(0);
    }
    expect(evaluationStateLabel("AwaitingManager")).toBe("Awaiting manager");
  });

  it("assigns a defined tone to every known status", () => {
    const tones = new Set([
      "neutral",
      "info",
      "success",
      "warning",
      "danger",
      "muted",
    ]);
    for (const status of [
      "NotStarted",
      "InProgress",
      "Submitted",
      "Finalized",
      "Acknowledged",
      "AwaitingManager",
    ]) {
      expect(tones.has(evaluationStateTone(status))).toBe(true);
    }
    expect(evaluationStateTone("Finalized")).toBe("success");
    expect(evaluationStateTone("AwaitingManager")).toBe("muted");
  });

  it("labels round types and assessment models in product language", () => {
    expect(roundTypeLabel("YearEnd")).toBe("Year-end review");
    expect(roundTypeLabel("MidCycle")).toBe("Mid-cycle review");
    expect(assessmentModelLabel("ManagerOnly")).toBe("Manager assessment");
  });

  it("labels and tones proficiency gaps", () => {
    expect(gapStateLabel("Below")).toBe("Below expected");
    expect(gapStateLabel("Exceeds")).toBe("Above expected");
    expect(gapStateTone("Below")).toBe("warning");
    expect(gapStateTone("Exceeds")).toBe("success");
  });

  it("groups queue items by attention state", () => {
    expect(queueGroupFor(queueItem({ status: "Submitted", actionable: true }))).toBe(
      "readyToFinalize"
    );
    expect(queueGroupFor(queueItem({ status: "InProgress", actionable: true }))).toBe(
      "inAssessment"
    );
    expect(queueGroupFor(queueItem({ actionable: false }))).toBe(
      "awaitingEmployee"
    );
    expect(
      queueGroupFor(
        queueItem({ status: "Finalized", acknowledgedAt: null })
      )
    ).toBe("awaitingAcknowledgement");
    expect(
      queueGroupFor(
        queueItem({ status: "Finalized", acknowledgedAt: "2026-07-01" })
      )
    ).toBe("done");
  });
});
