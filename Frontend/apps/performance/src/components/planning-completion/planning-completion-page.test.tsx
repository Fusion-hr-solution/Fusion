// @vitest-environment happy-dom

import React from "react";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import type {
  PlanningCompletionParticipantDetailDto,
  PlanningCompletionParticipantDto,
  PlanningCompletionWorkspaceDto,
} from "@repo/api";
import { PlanningCompletionPage } from "./planning-completion-page";

type TestUser = {
  fullName: string;
  effectivePermissions: Array<{ permissionKey: string; scope: string }>;
};

const state = vi.hoisted(() => ({
  user: {
    fullName: "HR Admin",
    effectivePermissions: [
      { permissionKey: "performance.cycle.manage", scope: "Tenant" },
      { permissionKey: "performance.cycle.publish", scope: "Tenant" },
    ],
  } as TestUser | null,
  routeParams: { slug: "fy26-planning-2026" },
  workspace: undefined as PlanningCompletionWorkspaceDto | undefined,
  detail: undefined as PlanningCompletionParticipantDetailDto | undefined,
}));

vi.mock("next/navigation", () => ({
  useParams: () => state.routeParams,
}));

vi.mock("@repo/auth", () => ({
  useAuth: () => ({ user: state.user, isLoading: false }),
  canViewPerformanceCampaigns: (user: TestUser | null) =>
    user?.effectivePermissions.some(
      (grant) =>
        grant.scope === "Tenant" &&
        (grant.permissionKey === "performance.cycle.view" ||
          grant.permissionKey === "performance.cycle.manage"),
    ) ?? false,
  canManagePerformanceCampaigns: (user: TestUser | null) =>
    user?.effectivePermissions.some(
      (grant) => grant.scope === "Tenant" && grant.permissionKey === "performance.cycle.manage",
    ) ?? false,
  canOperatePerformanceCycles: (user: TestUser | null) =>
    user?.effectivePermissions.some(
      (grant) => grant.scope === "Tenant" && grant.permissionKey === "performance.cycle.publish",
    ) ?? false,
}));

vi.mock("@repo/api", async () => {
  const actual = await vi.importActual("@repo/api");
  return {
    ...actual,
    createPlatformApiClient: () => ({
      get: vi.fn(),
      post: vi.fn(),
    }),
  };
});

vi.mock("@repo/api/query", () => ({
  useApiQuery: (queryKey: unknown) => {
    const key = JSON.stringify(queryKey ?? []);
    return {
      data: key.includes('"participant"') ? state.detail : state.workspace,
      isLoading: false,
      isFetching: false,
      error: null,
      refetch: vi.fn(),
      invalidate: vi.fn(),
    };
  },
  useApiMutation: () => ({
    mutate: vi.fn(),
    mutateAsync: vi.fn(),
    data: undefined,
    error: null,
    isLoading: false,
    reset: vi.fn(),
  }),
}));

vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

let root: Root | null = null;
let container: HTMLDivElement | null = null;

afterEach(() => {
  if (root) {
    act(() => root?.unmount());
  }
  root = null;
  container = null;
  state.user = {
    fullName: "HR Admin",
    effectivePermissions: [
      { permissionKey: "performance.cycle.manage", scope: "Tenant" },
      { permissionKey: "performance.cycle.publish", scope: "Tenant" },
    ],
  };
  state.workspace = undefined;
  state.detail = undefined;
});

describe("PlanningCompletionPage", () => {
  it("renders ready-to-lock completion state with participant detail and lock action", () => {
    const participant = participantDto({ status: "approved", statusLabel: "Approved", isApproved: true });
    state.workspace = workspaceDto({
      state: "ready-to-lock",
      summary: {
        totalParticipants: 1,
        approvedCount: 1,
        excludedCount: 0,
        remainingCount: 0,
        notStartedCount: 0,
        draftCount: 0,
        submittedCount: 0,
        changesRequestedCount: 0,
        blockedCount: 0,
        overdueCount: 0,
        reminderNeededCount: 0,
        isReadyToLock: true,
      },
      participants: { items: [participant], totalCount: 1, page: 1, pageSize: 80 },
    });
    state.detail = { participant, reminderHistory: [], reassignmentHistory: [] };

    const page = render(<PlanningCompletionPage />);

    expect(page.textContent).toContain("FY26 Planning");
    expect(page.textContent).toContain("Ready to lock");
    expect(page.textContent).toContain("1approved");
    expect(page.textContent).toContain("Flit Employee");
    expect(page.textContent).toContain("Flit Manager");
    const lockButton = buttonText(page, "Lock planning");
    expect(lockButton).toBeTruthy();

    act(() => lockButton?.click());

    expect(document.body.textContent).toContain("Remaining");
    expect(document.body.textContent).not.toContain("Lock planning?");
    expect(
      Array.from(document.body.querySelectorAll("button"))
        .filter((button) => button.textContent?.includes("Lock planning"))
        .some((button) => !button.disabled),
    ).toBe(true);

    act(() => {
      const dialogLockButton = Array.from(document.body.querySelectorAll("button"))
        .filter((button) => button.textContent?.includes("Lock planning"))
        .at(-1) as HTMLButtonElement | undefined;
      dialogLockButton?.click();
    });

    expect(document.body.textContent).toContain("Lock planning?");
    expect(document.body.textContent).toContain("This will freeze 1 approved and 0 excluded employee plans");
  });

  it("bounds the employee plan queue and points users to search instead of dumping every participant", () => {
    const participants = Array.from({ length: 12 }, (_, index) =>
      participantDto({
        participantEmployeeId: `employee-${index + 1}`,
        employeeName: `Employee ${index + 1}`,
        email: `employee.${index + 1}@example.com`,
      }),
    );
    state.workspace = workspaceDto({
      participants: { items: participants, totalCount: 12, page: 1, pageSize: 80 },
    });
    state.detail = { participant: participants[0]!, reminderHistory: [], reassignmentHistory: [] };

    const page = render(<PlanningCompletionPage />);

    expect(page.textContent).toContain("Employee plans");
    expect(page.textContent).toContain("Participants are employees in this campaign");
    expect(page.textContent).toContain("Showing the first 10 employee plans");
    expect(page.textContent).toContain("Employee 10");
    expect(page.textContent).not.toContain("Employee 11");
    expect(
      Array.from(page.querySelectorAll("button")).filter((button) =>
        button.textContent?.includes("Employee "),
      ),
    ).toHaveLength(10);
  });

  it("keeps locked completion read-only while preserving review context", () => {
    const participant = participantDto({
      status: "approved",
      statusLabel: "Approved",
      isApproved: true,
      lastReminder: {
        id: "reminder-1",
        targetEmployeeId: "employee-1",
        targetName: "Flit Employee",
        targetType: "Participant",
        reason: "Followed up before lock.",
        recordedByName: "HR Admin",
        recordedAt: "2026-02-01T00:00:00Z",
        notificationTriggered: false,
      },
    });
    state.workspace = workspaceDto({
      state: "locked",
      planningLockedAt: "2026-02-15T00:00:00Z",
      planningLockedByName: "HR Admin",
      summary: {
        totalParticipants: 1,
        approvedCount: 1,
        excludedCount: 0,
        remainingCount: 0,
        notStartedCount: 0,
        draftCount: 0,
        submittedCount: 0,
        changesRequestedCount: 0,
        blockedCount: 0,
        overdueCount: 0,
        reminderNeededCount: 0,
        isReadyToLock: true,
      },
      participants: { items: [participant], totalCount: 1, page: 1, pageSize: 80 },
    });
    state.detail = {
      participant,
      reminderHistory: [participant.lastReminder!],
      reassignmentHistory: [],
    };

    const page = render(<PlanningCompletionPage />);

    expect(page.textContent).toContain("Locked baseline");
    expect(page.textContent).toContain("Followed up before lock.");
    expect(buttonText(page, "Lock planning")).toBeFalsy();
    expect(buttonText(page, "Record reminder")?.disabled).toBe(true);
    expect(buttonText(page, "Reassign reviewer")?.disabled).toBe(true);
    expect(buttonText(page, "Exclude")?.disabled).toBe(true);
  });

  it("shows permission denial without exposing completion data", () => {
    state.user = {
      fullName: "Employee",
      effectivePermissions: [],
    };
    state.workspace = workspaceDto();

    const page = render(<PlanningCompletionPage />);

    expect(page.textContent).toContain("Campaign access required");
    expect(page.textContent).not.toContain("Flit Employee");
  });
});

function render(node: React.ReactNode) {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  act(() => root?.render(node));
  return container;
}

function buttonText(page: HTMLElement, text: string) {
  return Array.from(page.querySelectorAll("button")).find((button) =>
    button.textContent?.includes(text),
  ) as HTMLButtonElement | undefined;
}

function workspaceDto(overrides: Partial<PlanningCompletionWorkspaceDto> = {}): PlanningCompletionWorkspaceDto {
  const participant = participantDto();
  return {
    state: "actionable",
    cycleId: "cycle-1",
    slug: "fy26-planning-2026",
    name: "FY26 Planning",
    referenceYear: 2026,
    planningOpeningDate: "2026-01-01",
    employeeSubmissionDeadline: "2026-01-31",
    managerApprovalDeadline: "2026-02-14",
    expectedPlanningLockDate: "2026-02-15",
    launchedAt: "2026-01-01T00:00:00Z",
    planningLockedAt: null,
    planningLockedByName: null,
    version: 7,
    summary: {
      totalParticipants: 1,
      approvedCount: 0,
      excludedCount: 0,
      remainingCount: 1,
      notStartedCount: 0,
      draftCount: 0,
      submittedCount: 1,
      changesRequestedCount: 0,
      blockedCount: 0,
      overdueCount: 0,
      reminderNeededCount: 0,
      isReadyToLock: false,
    },
    remainingGroups: [{ code: "submitted", label: "Manager review", count: 1 }],
    participants: { items: [participant], totalCount: 1, page: 1, pageSize: 80 },
    ...overrides,
  };
}

function participantDto(
  overrides: Partial<PlanningCompletionParticipantDto> = {},
): PlanningCompletionParticipantDto {
  return {
    participantEmployeeId: "employee-1",
    employeeName: "Flit Employee",
    employeeKey: "E-001",
    email: "flit.employee@example.com",
    jobTitle: "Consultant",
    orgUnitName: "Advisory",
    status: "submitted",
    statusLabel: "Submitted",
    isApproved: false,
    isExcluded: false,
    isBlocked: false,
    isOverdue: false,
    reminderNeeded: false,
    lastActivityAt: "2026-01-20T00:00:00Z",
    plan: {
      planId: "plan-1",
      status: "Submitted",
      statusLabel: "Submitted",
      objectiveCount: 3,
      totalWeight: 100,
      submittedAt: "2026-01-20T00:00:00Z",
      approvedAt: null,
      version: 3,
    },
    frozenReviewer: {
      employeeId: "manager-1",
      name: "Flit Manager",
      isActive: true,
    },
    effectiveReviewer: {
      employeeId: "manager-1",
      name: "Flit Manager",
      isActive: true,
    },
    reviewerWasReassigned: false,
    exclusion: null,
    blockers: [],
    overdueIndicators: [],
    lastReminder: null,
    ...overrides,
  };
}
