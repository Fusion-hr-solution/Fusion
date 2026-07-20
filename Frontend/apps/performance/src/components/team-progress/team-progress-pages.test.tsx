// @vitest-environment happy-dom

import React from "react";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import type {
  TeamProgressCampaignDto,
  TeamProgressParticipantDetailDto,
  TeamProgressWorkspaceDto,
} from "@repo/api";
import {
  TeamProgressCampaignsPage,
  TeamProgressWorkspacePage,
} from "./team-progress-pages";

type TestUser = { fullName: string; employeeId: string | null };

const state = vi.hoisted(() => ({
  user: { fullName: "Manager", employeeId: "emp-1" } as TestUser | null,
  routeParams: { slug: "fy26-progress" } as { slug?: string },
  campaigns: undefined as TeamProgressCampaignDto[] | undefined,
  workspace: undefined as TeamProgressWorkspaceDto | undefined,
  participantDetail: undefined as TeamProgressParticipantDetailDto | undefined,
}));

vi.mock("next/navigation", () => ({
  useParams: () => state.routeParams,
}));

vi.mock("@repo/auth", () => ({
  useAuth: () => ({ user: state.user, isLoading: false }),
  canAccessTeamProgress: (user: TestUser | null) => !!user?.employeeId,
}));

vi.mock("@repo/api", async () => {
  const actual = await vi.importActual("@repo/api");
  return {
    ...actual,
    createPlatformApiClient: () => ({ get: vi.fn(), post: vi.fn() }),
  };
});

vi.mock("@repo/api/query", () => ({
  useApiQuery: (queryKey: unknown) => {
    const key = JSON.stringify(queryKey ?? []);
    return {
      data: key.includes('"participant"')
        ? state.participantDetail
        : key.includes('"workspace"')
          ? state.workspace
          : state.campaigns,
      isLoading: false,
      isFetching: false,
      error: null,
      refetch: vi.fn(),
    };
  },
}));

let root: Root | null = null;

afterEach(() => {
  if (root) act(() => root?.unmount());
  root = null;
  state.user = { fullName: "Manager", employeeId: "emp-1" };
  state.campaigns = undefined;
  state.workspace = undefined;
  state.participantDetail = undefined;
});

function render(node: React.ReactElement): HTMLDivElement {
  const container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  act(() => root?.render(node));
  return container;
}

describe("TeamProgressCampaignsPage", () => {
  it("shows an empty state when the reviewer follows no campaigns", () => {
    state.campaigns = [];
    const page = render(<TeamProgressCampaignsPage />);
    expect(page.textContent).toContain("No team progress to follow yet");
  });

  it("lists campaigns with an attention count", () => {
    state.campaigns = [
      {
        id: "c1",
        slug: "fy26-progress",
        name: "FY26 Progress",
        referenceYear: 2026,
        launchedAt: null,
        planningLockedAt: null,
        participantCount: 4,
        needsAttentionCount: 2,
      },
    ];
    const page = render(<TeamProgressCampaignsPage />);
    expect(page.textContent).toContain("FY26 Progress");
    expect(page.textContent).toContain("2 need");
    expect(page.textContent).toContain("50% attention");
    expect(
      page.querySelector('[aria-label="50% of participants need attention"]')
    ).toBeTruthy();
    expect(
      page.querySelector('a[href="/team-progress/fy26-progress"]')
    ).toBeTruthy();
  });
});

describe("TeamProgressWorkspacePage", () => {
  it("orders needs-attention participants first with their signals", () => {
    state.workspace = {
      cycleId: "c1",
      slug: "fy26-progress",
      name: "FY26 Progress",
      referenceYear: 2026,
      launchedAt: null,
      planningLockedAt: null,
      staleAfterDays: 30,
      participants: [
        {
          employeeId: "e-att",
          employeeName: "Ada Attention",
          weightedProgressPercent: 20,
          objectiveCount: 2,
          completedObjectiveCount: 0,
          staleObjectiveCount: 1,
          hasRecentRegression: false,
          notStartedObjectiveCount: 1,
          needsAttention: true,
          lastActivityAt: null,
          objectives: [],
        },
      ],
    };
    const page = render(<TeamProgressWorkspacePage />);
    expect(page.textContent).toContain("Ada Attention");
    expect(page.textContent).toContain("Needs attention");
    expect(page.textContent).toContain("1 not started");
    expect(page.textContent).toContain("1 stale");
    expect(page.textContent).toContain("20% average progress");
  });

  it("shows the first participant's objective detail in the desktop workspace", () => {
    state.workspace = {
      cycleId: "c1",
      slug: "fy26-progress",
      name: "FY26 Progress",
      referenceYear: 2026,
      launchedAt: null,
      planningLockedAt: null,
      staleAfterDays: 30,
      participants: [
        {
          employeeId: "e-sami",
          employeeName: "Sami Analyst",
          weightedProgressPercent: 54,
          objectiveCount: 1,
          completedObjectiveCount: 0,
          staleObjectiveCount: 1,
          hasRecentRegression: true,
          notStartedObjectiveCount: 0,
          needsAttention: true,
          lastActivityAt: null,
          objectives: [],
        },
      ],
    };
    state.participantDetail = {
      cycleId: "c1",
      slug: "fy26-progress",
      name: "FY26 Progress",
      employeeId: "e-sami",
      employeeName: "Sami Analyst",
      progress: {
        weightedProgressPercent: 54,
        objectiveCount: 1,
        completedObjectiveCount: 0,
        staleObjectiveCount: 1,
        staleAfterDays: 30,
        objectives: [],
      },
      objectives: [
        {
          objective: {
            id: "o1",
            title: "Improve customer response time",
            description: null,
            alignmentType: null,
            alignmentTargetId: null,
            alignmentTitle: null,
            weight: 100,
            deadline: null,
            measurementMethod: null,
            measurementIndicator: null,
            targetValue: null,
            targetUnit: null,
            successCriteria: null,
            createdAt: "2026-01-01T00:00:00Z",
            updatedAt: null,
          },
          state: {
            objectiveId: "o1",
            currentPercent: 54,
            state: "in-progress",
            isStale: true,
            lastUpdateAt: null,
            updateCount: 0,
            lastActualValue: null,
          },
          history: [],
        },
      ],
    };

    const page = render(<TeamProgressWorkspacePage />);
    expect(page.textContent).toContain("Team pulse");
    expect(page.textContent).toContain("Objectives");
    expect(page.textContent).toContain("Improve customer response time");
    expect(page.querySelector('button[aria-pressed="true"]')).toBeTruthy();
  });

  it("shows a truthful empty state when the reviewer has no participants in scope", () => {
    state.workspace = {
      cycleId: "c1",
      slug: "fy26-progress",
      name: "FY26 Progress",
      referenceYear: 2026,
      launchedAt: null,
      planningLockedAt: null,
      staleAfterDays: 30,
      participants: [],
    };
    const page = render(<TeamProgressWorkspacePage />);
    expect(page.textContent).toContain("No one to follow here yet");
  });
});
