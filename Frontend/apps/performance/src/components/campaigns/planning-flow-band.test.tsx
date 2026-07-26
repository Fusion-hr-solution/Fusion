// @vitest-environment happy-dom

import React from "react";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { PlanningCompletionWorkspaceDto } from "@repo/api";
import {
  PlanningFlowBand,
  type PlanningFlowBandAccess,
} from "./planning-flow-band";

const state = vi.hoisted(() => ({
  cascade: undefined as unknown,
  cascadeError: null as Error | null,
  completion: undefined as unknown,
  completionError: null as Error | null,
  mutationCalls: 0,
}));

vi.mock("next/link", () => ({
  default: ({
    href,
    children,
    className,
  }: {
    href: string;
    children: React.ReactNode;
    className?: string;
  }) => (
    <a href={href} className={className}>
      {children}
    </a>
  ),
}));

vi.mock("@repo/api", async () => {
  const actual = await vi.importActual("@repo/api");
  return {
    ...actual,
    createPlatformApiClient: () => ({
      get: vi.fn(),
      post: vi.fn(),
      put: vi.fn(),
      delete: vi.fn(),
    }),
  };
});

vi.mock("@repo/api/query", () => ({
  useApiQuery: (queryKey: unknown, _fn: unknown, options?: { enabled?: boolean }) => {
    const enabled = options?.enabled ?? true;
    const key = JSON.stringify(queryKey ?? []);
    if (key.includes("cascade-coverage")) {
      return {
        data: enabled ? state.cascade : undefined,
        error: state.cascadeError,
        isLoading: enabled && state.cascade === undefined && state.cascadeError === null,
        isFetching: false,
        refetch: vi.fn(),
        invalidate: vi.fn(),
      };
    }
    if (key.includes("planning-completion")) {
      return {
        data: enabled ? state.completion : undefined,
        error: state.completionError,
        isLoading:
          enabled && state.completion === undefined && state.completionError === null,
        isFetching: false,
        refetch: vi.fn(),
        invalidate: vi.fn(),
      };
    }
    return {
      data: undefined,
      error: null,
      isLoading: false,
      isFetching: false,
      refetch: vi.fn(),
      invalidate: vi.fn(),
    };
  },
  // A mutation anywhere in this read-only path is a regression: reads never write.
  useApiMutation: () => {
    state.mutationCalls += 1;
    return { mutate: vi.fn(), mutateAsync: vi.fn(), isLoading: false };
  },
}));

let root: Root | null = null;
let container: HTMLDivElement | null = null;

afterEach(() => {
  if (root) act(() => root?.unmount());
  root = null;
  container = null;
  state.cascade = undefined;
  state.cascadeError = null;
  state.completion = undefined;
  state.completionError = null;
  state.mutationCalls = 0;
});

function render(node: React.ReactNode) {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  act(() => root?.render(node));
  return container;
}

const hrAccess: PlanningFlowBandAccess = {
  canViewStrategy: false,
  canAccessTeam: false,
  canAccessMine: false,
  canAccessApprovals: false,
  canViewCompletion: true,
  canReadCascade: true,
  canReadCompletion: true,
};

function cascade(overrides: Record<string, unknown> = {}) {
  return {
    cycleId: "c1",
    slug: "fy26",
    name: "FY26",
    referenceYear: 2026,
    planningOpeningDate: "2026-01-15T00:00:00Z",
    employeeSubmissionDeadline: "2026-02-15T00:00:00Z",
    launchedAt: "2026-01-01T00:00:00Z",
    activeStrategicObjectiveCount: 4,
    coveredStrategicObjectiveCount: 3,
    managerCount: 5,
    managersWithTeamObjectivesCount: 4,
    teamObjectiveCount: 9,
    strategicObjectives: [],
    managers: [],
    teamObjectives: [],
    ...overrides,
  };
}

function completion(
  summary: Partial<PlanningCompletionWorkspaceDto["summary"]> = {},
  overrides: Partial<PlanningCompletionWorkspaceDto> = {},
): PlanningCompletionWorkspaceDto {
  return {
    state: "actionable",
    cycleId: "c1",
    slug: "fy26",
    name: "FY26",
    referenceYear: 2026,
    planningOpeningDate: "2026-01-15T00:00:00Z",
    employeeSubmissionDeadline: "2026-02-15T00:00:00Z",
    managerApprovalDeadline: "2026-03-01T00:00:00Z",
    expectedPlanningLockDate: "2026-03-15T00:00:00Z",
    launchedAt: "2026-01-01T00:00:00Z",
    planningLockedAt: null,
    planningLockedByName: null,
    version: 1,
    summary: {
      totalParticipants: 100,
      approvedCount: 10,
      excludedCount: 0,
      remainingCount: 80,
      notStartedCount: 40,
      draftCount: 10,
      submittedCount: 30,
      changesRequestedCount: 10,
      blockedCount: 0,
      overdueCount: 0,
      reminderNeededCount: 0,
      isReadyToLock: false,
      ...summary,
    },
    remainingGroups: [],
    participants: { items: [], totalCount: 0, page: 1, pageSize: 1 },
    ...overrides,
  };
}

describe("PlanningFlowBand", () => {
  it("renders five stages with state from the read models, no writes", () => {
    state.cascade = cascade();
    state.completion = completion();

    const page = render(
      <PlanningFlowBand
        slug="fy26"
        planningOpeningDate="2026-01-15T00:00:00Z"
        locked={false}
        access={hrAccess}
      />,
    );

    // Strategy + Team from cascade; Employee/Approvals/Completion from completion.
    expect(page.textContent).toContain("Strategy coverage");
    expect(page.textContent).toContain("3/4 covered");
    expect(page.textContent).toContain("4/5 managers");
    // 30 submitted + 10 changes-requested + 10 approved = 50 of 100 active.
    expect(page.textContent).toContain("50/100 in");
    expect(page.textContent).toContain("30 awaiting reviews");
    expect(page.textContent).toContain("80 people left");
    // No mutation hooks were instantiated in this path.
    expect(state.mutationCalls).toBe(0);
  });

  it("shows the completion stage as locked and read-only when planning is locked", () => {
    state.cascade = cascade();
    state.completion = completion({}, { planningLockedAt: "2026-03-20T00:00:00Z" });

    const page = render(
      <PlanningFlowBand
        slug="fy26"
        planningOpeningDate="2026-01-15T00:00:00Z"
        locked
        access={hrAccess}
      />,
    );

    expect(page.textContent).toContain("Planning locked");
    // A read-only band exposes no form controls or buttons.
    expect(page.querySelectorAll("button")).toHaveLength(0);
  });

  it("links only to workspaces the viewer can operate (fail closed on actions)", () => {
    state.cascade = cascade();
    state.completion = completion();

    // Pure HR: reads both models, can open Completion, but has no employee link
    // so Team/My/Approvals are not operable.
    const page = render(
      <PlanningFlowBand
        slug="fy26"
        planningOpeningDate="2026-01-15T00:00:00Z"
        locked={false}
        access={hrAccess}
      />,
    );

    expect(page.querySelector('a[href="/campaigns/fy26/completion"]')).toBeTruthy();
    expect(page.querySelector('a[href="/team-objectives/fy26"]')).toBeNull();
    expect(page.querySelector('a[href="/my-objectives/fy26"]')).toBeNull();
    expect(page.querySelector('a[href="/plan-approvals/fy26"]')).toBeNull();
    // But the team stage still shows its monitoring state.
    expect(page.textContent).toContain("4/5 managers");
  });

  it("carries the campaign slug on every operable stage link", () => {
    state.cascade = cascade();
    state.completion = completion();

    const page = render(
      <PlanningFlowBand
        slug="fy26"
        planningOpeningDate="2026-01-15T00:00:00Z"
        locked={false}
        access={{
          canViewStrategy: true,
          canAccessTeam: true,
          canAccessMine: true,
          canAccessApprovals: true,
          canViewCompletion: true,
          canReadCascade: true,
          canReadCompletion: true,
        }}
      />,
    );

    expect(page.querySelector('a[href="/strategy/fy26"]')).toBeTruthy();
    expect(page.querySelector('a[href="/team-objectives/fy26"]')).toBeTruthy();
    expect(page.querySelector('a[href="/my-objectives/fy26"]')).toBeTruthy();
    expect(page.querySelector('a[href="/plan-approvals/fy26"]')).toBeTruthy();
    expect(page.querySelector('a[href="/campaigns/fy26/completion"]')).toBeTruthy();
  });

  it("reads a launched-but-not-open campaign as opening on its scheduled date", () => {
    state.cascade = cascade();
    state.completion = completion();
    const future = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

    const page = render(
      <PlanningFlowBand
        slug="fy26"
        planningOpeningDate={future}
        locked={false}
        access={hrAccess}
      />,
    );

    expect(page.textContent).toContain("Opens");
    // Submission counts must not read as "employees can plan now" before the window opens.
    expect(page.textContent).not.toContain("50/100 in");
  });
});
