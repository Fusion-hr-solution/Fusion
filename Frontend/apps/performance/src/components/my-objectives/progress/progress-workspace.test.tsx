// @vitest-environment happy-dom

import React from "react";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import type {
  EmployeeObjectivePlanWorkspaceDto,
  RecordObjectiveProgressResponseDto,
} from "@repo/api";
import { ProgressWorkspace } from "./progress-workspace";

const mutationHarness = vi.hoisted(() => ({
  options: null as null | {
    onSuccess: (result: RecordObjectiveProgressResponseDto) => Promise<void>;
  },
}));

vi.mock("@repo/api", async () => {
  const actual = await vi.importActual("@repo/api");
  return {
    ...actual,
    createPlatformApiClient: () => ({ get: vi.fn(), post: vi.fn() }),
  };
});

vi.mock("@repo/api/query", () => ({
  useApiMutation: (
    _mutation: unknown,
    options: { onSuccess: (result: RecordObjectiveProgressResponseDto) => Promise<void> },
  ) => {
    mutationHarness.options = options;
    return { mutate: vi.fn(), isLoading: false };
  },
}));

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

let root: Root | null = null;

afterEach(() => {
  if (root) act(() => root?.unmount());
  root = null;
  document.body.innerHTML = "";
  mutationHarness.options = null;
});

function render(node: React.ReactElement): HTMLDivElement {
  const container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  act(() => root?.render(node));
  return container;
}

function lockedApprovedWorkspace(): EmployeeObjectivePlanWorkspaceDto {
  return {
    state: "locked-approved",
    cycleId: "c1",
    slug: "fy26-progress",
    name: "FY26 Progress",
    referenceYear: 2026,
    planningOpeningDate: null,
    employeeSubmissionDeadline: null,
    managerApprovalDeadline: null,
    launchedAt: null,
    planningLockedAt: "2026-02-01T00:00:00Z",
    planningLockedByName: "HR Admin",
    maxObjectiveCount: 5,
    allowedWeights: [40, 60],
    enabledMeasurementMethods: ["Quantitative", "Qualitative"],
    alignmentOptions: [],
    plan: {
      id: "p1",
      cycleId: "c1",
      employeeId: "e1",
      status: "Approved",
      submittedAt: null,
      approverEmployeeId: "m1",
      approverName: "Mia Manager",
      approvedAt: null,
      approvingManagerEmployeeId: "m1",
      approvingManagerName: "Mia Manager",
      lastChangeRequestComment: null,
      objectiveCount: 1,
      totalWeight: 100,
      version: 3,
      objectives: [
        {
          id: "o1",
          title: "Improve delivery quality",
          description: null,
          alignmentType: "StrategicObjective",
          alignmentTargetId: "s1",
          alignmentTitle: "Grow delivery",
          weight: 100,
          deadline: "2026-06-30T00:00:00Z",
          measurementMethod: "Quantitative",
          measurementIndicator: "NPS",
          targetValue: "60",
          targetUnit: "%",
          successCriteria: null,
          createdAt: "2026-01-10T00:00:00Z",
          updatedAt: null,
        },
      ],
      reviewHistory: [],
    },
    progress: {
      weightedProgressPercent: 50,
      objectiveCount: 1,
      completedObjectiveCount: 0,
      staleObjectiveCount: 0,
      staleAfterDays: 30,
      objectives: [
        {
          objectiveId: "o1",
          currentPercent: 50,
          state: "in-progress",
          isStale: false,
          lastUpdateAt: "2026-03-01T00:00:00Z",
          updateCount: 1,
          lastActualValue: "30 reached",
        },
      ],
    },
    progressHistory: [
      {
        id: "u1",
        objectiveId: "o1",
        progressPercent: 50,
        previousPercent: 0,
        actualValue: "30 reached",
        comment: "Halfway there",
        isRegression: false,
        regressionReason: null,
        actorName: "Alice Employee",
        recordedAt: "2026-03-01T00:00:00Z",
        evidence: [],
      },
    ],
  };
}

describe("ProgressWorkspace", () => {
  it("renders the weighted-progress hero and an objective progress card", () => {
    const page = render(
      <ProgressWorkspace workspace={lockedApprovedWorkspace()} onRecorded={async () => {}} />,
    );
    expect(page.textContent).toContain("Plan progress");
    // Weighted hero numeral.
    expect(page.textContent).toContain("50");
    expect(page.textContent).toContain("Improve delivery quality");
    // Derived state surfaced in product language.
    expect(page.textContent).toContain("In progress");
    expect(page.textContent).toContain("Locked baseline");
  });

  it("preserves dialog input and invites retry after a conflict", async () => {
    const onRecorded = vi.fn(async () => undefined);
    render(
      <ProgressWorkspace workspace={lockedApprovedWorkspace()} onRecorded={onRecorded} />,
    );

    const openButton = Array.from(document.querySelectorAll("button")).find((button) =>
      button.textContent?.includes("Update progress"),
    );
    expect(openButton).toBeDefined();
    act(() => openButton?.dispatchEvent(new MouseEvent("click", { bubbles: true })));

    const comment = document.querySelector<HTMLTextAreaElement>("#progress-comment");
    expect(comment).not.toBeNull();
    act(() => {
      const setValue = Object.getOwnPropertyDescriptor(
        HTMLTextAreaElement.prototype,
        "value",
      )?.set;
      setValue?.call(comment, "Customer milestone moved");
      comment?.dispatchEvent(new Event("input", { bubbles: true }));
    });

    await act(async () => {
      await mutationHarness.options?.onSuccess({
        recorded: false,
        outcome: "conflict",
        retryable: true,
        update: null,
        progress: null,
        planVersion: 4,
        blockingReasons: [],
      });
    });

    expect(onRecorded).toHaveBeenCalledOnce();
    expect(document.querySelector<HTMLTextAreaElement>("#progress-comment")?.value)
      .toBe("Customer milestone moved");
    expect(document.body.textContent).toContain(
      "Progress changed while you were recording. Review the latest value and try again.",
    );
  });
});
