// @vitest-environment happy-dom

import React from "react";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { PerformanceCycleSummaryDto } from "@repo/api";

import { CampaignHistoryPage } from "./campaign-history-page";
import { CampaignListPage } from "./campaigns-page";

type TestUser = {
  fullName: string;
  employeeId?: string;
  effectivePermissions: Array<{ permissionKey: string; scope: string }>;
};

const state = vi.hoisted(() => ({
  user: {
    fullName: "HR Admin",
    effectivePermissions: [
      { permissionKey: "performance.cycle.manage", scope: "Tenant" },
    ],
  } as TestUser | null,
  campaigns: [] as PerformanceCycleSummaryDto[],
  queryError: null as Error | null,
}));

vi.mock("next/navigation", () => ({
  useParams: () => ({}),
  useRouter: () => ({ push: vi.fn() }),
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
      (grant) =>
        grant.scope === "Tenant" &&
        grant.permissionKey === "performance.cycle.manage",
    ) ?? false,
  canOperatePerformanceCycles: () => false,
  canAccessMyObjectives: () => false,
  canAccessTeamObjectives: () => false,
  canAccessPlanApprovals: () => false,
  canAccessTeamProgress: () => false,
  canViewPerformanceStrategy: () => false,
}));

vi.mock("@repo/api", async () => {
  const actual = await vi.importActual("@repo/api");
  return {
    ...actual,
    createPlatformApiClient: () => ({
      get: vi.fn(),
      post: vi.fn(),
      put: vi.fn(),
    }),
  };
});

vi.mock("@repo/api/query", () => ({
  useApiQueryClient: () => ({
    setQueryData: vi.fn(),
    invalidateQueries: vi.fn(),
  }),
  useApiQuery: () => ({
    data: state.queryError
      ? undefined
      : {
          items: state.campaigns,
          totalCount: state.campaigns.length,
          page: 1,
          pageSize: 100,
          totalPages: 1,
          hasNextPage: false,
          hasPreviousPage: false,
        },
    isLoading: false,
    isFetching: false,
    error: state.queryError,
    refetch: vi.fn(),
    invalidate: vi.fn(),
  }),
  useApiMutation: () => ({
    mutate: vi.fn(),
    mutateAsync: vi.fn(),
    isLoading: false,
    error: null,
  }),
}));

let container: HTMLElement | null = null;
let root: Root | null = null;

afterEach(() => {
  act(() => root?.unmount());
  container?.remove();
  container = null;
  root = null;
  state.user = {
    fullName: "HR Admin",
    effectivePermissions: [
      { permissionKey: "performance.cycle.manage", scope: "Tenant" },
    ],
  };
  state.campaigns = [];
  state.queryError = null;
});

function render(node: React.ReactNode) {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  act(() => root?.render(node));
  return container;
}

function campaign(
  overrides: Partial<PerformanceCycleSummaryDto> = {},
): PerformanceCycleSummaryDto {
  return {
    id: overrides.id ?? "cycle-1",
    name: "FY26 Annual Planning",
    slug: "fy26-annual-planning",
    status: "Launched",
    type: "Annual",
    referenceYear: 2026,
    periodStart: "2026-01-01T00:00:00Z",
    periodEnd: "2026-12-31T00:00:00Z",
    objectiveSettingDeadline: null,
    deadlineState: "None",
    participantCount: 12,
    launchedAt: "2026-01-05T00:00:00Z",
    closedAt: null,
    planningLockedAt: null,
    ownerName: "HR Admin",
    ...overrides,
  } as PerformanceCycleSummaryDto;
}

const closed = (overrides: Partial<PerformanceCycleSummaryDto> = {}) =>
  campaign({
    id: "cycle-closed",
    name: "FY25 Annual Planning",
    slug: "fy25-annual-planning",
    status: "Closed",
    referenceYear: 2025,
    closedAt: "2025-12-20T00:00:00Z",
    ...overrides,
  });

// ── Active list: closed campaigns leave it ───────────────────────────────────

describe("campaign list closure behaviour", () => {
  it("keeps a closed campaign out of the active list", () => {
    state.campaigns = [campaign(), closed()];

    const page = render(<CampaignListPage />);

    expect(page.textContent).toContain("FY26 Annual Planning");
    expect(page.textContent).not.toContain("FY25 Annual Planning");
  });

  it("offers a route to history when something has closed", () => {
    state.campaigns = [campaign(), closed()];

    const page = render(<CampaignListPage />);

    expect(
      page.querySelector('a[href="/campaigns/history"]'),
    ).not.toBeNull();
  });

  it("offers no history route when nothing has ever closed", () => {
    state.campaigns = [campaign()];

    const page = render(<CampaignListPage />);

    // An affordance for an empty archive would be a dead end.
    expect(page.querySelector('a[href="/campaigns/history"]')).toBeNull();
  });

  it("invites navigation to history when every campaign has closed", () => {
    state.campaigns = [closed()];

    const page = render(<CampaignListPage />);

    // Not "no campaigns yet" — that would misreport a completed cycle as an absence.
    expect(page.textContent).toContain("Nothing active right now");
    expect(page.textContent).not.toContain("No campaigns yet");
    expect(page.querySelector('a[href="/campaigns/history"]')).not.toBeNull();
  });

  it("still reads as never-used when the tenant has no campaigns at all", () => {
    state.campaigns = [];

    const page = render(<CampaignListPage />);

    expect(page.textContent).toContain("No campaigns yet");
    expect(page.textContent).not.toContain("Nothing active right now");
  });
});

// ── History door ─────────────────────────────────────────────────────────────

describe("campaign history", () => {
  it("lists only closed campaigns, with their closure date", () => {
    state.campaigns = [campaign(), closed()];

    const page = render(<CampaignHistoryPage />);

    expect(page.textContent).toContain("FY25 Annual Planning");
    expect(page.textContent).not.toContain("FY26 Annual Planning");
    expect(page.textContent).toMatch(/Closed\s+\w+\s+\d{1,2},\s+2025/);
  });

  it("orders the most recently closed first", () => {
    state.campaigns = [
      closed({
        id: "older",
        name: "FY23 Planning",
        slug: "fy23",
        closedAt: "2023-12-01T00:00:00Z",
      }),
      closed({
        id: "newer",
        name: "FY25 Planning",
        slug: "fy25",
        closedAt: "2025-12-01T00:00:00Z",
      }),
    ];

    const page = render(<CampaignHistoryPage />);
    const names = Array.from(page.querySelectorAll("li")).map(
      (item) => item.textContent ?? "",
    );

    expect(names[0]).toContain("FY25 Planning");
    expect(names[1]).toContain("FY23 Planning");
  });

  it("renders no write affordance anywhere", () => {
    state.campaigns = [closed()];

    const page = render(<CampaignHistoryPage />);
    const labels = Array.from(page.querySelectorAll("button, a")).map(
      (element) => element.textContent?.toLowerCase() ?? "",
    );

    // Every campaign here is terminal, so nothing may offer to change one.
    for (const forbidden of [
      "launch",
      "discard",
      "delete",
      "lock",
      "close campaign",
      "new campaign",
      "create campaign",
      "save",
    ]) {
      expect(labels.some((label) => label.includes(forbidden))).toBe(false);
    }
  });

  it("reads as an empty archive rather than an error when nothing has closed", () => {
    state.campaigns = [campaign()];

    const page = render(<CampaignHistoryPage />);

    expect(page.textContent).toContain("No closed campaigns yet");
  });

  it("hides the record behind the same access rule as campaigns", () => {
    state.user = { fullName: "Nobody", effectivePermissions: [] };
    state.campaigns = [closed()];

    const page = render(<CampaignHistoryPage />);

    // Fails closed: no campaign names leak into a denial.
    expect(page.textContent).toContain("Campaign access required");
    expect(page.textContent).not.toContain("FY25 Annual Planning");
  });

  it("surfaces a load failure as retryable rather than as an empty archive", () => {
    state.queryError = new Error("boom");

    const page = render(<CampaignHistoryPage />);

    expect(page.textContent).toContain("Could not load campaign history");
    expect(page.textContent).not.toContain("No closed campaigns yet");
  });

  it("links each closed campaign to its read-only workspace", () => {
    state.campaigns = [closed()];

    const page = render(<CampaignHistoryPage />);

    expect(
      page.querySelector('a[href="/campaigns/fy25-annual-planning"]'),
    ).not.toBeNull();
  });
});
