// @vitest-environment happy-dom

import React from "react";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { PerformanceCycleDetailDto } from "@repo/api";
import { CampaignDraftPage, CampaignListPage } from "./campaigns-page";
import { CampaignCreateDialog } from "./campaign-create-dialog";
import {
  CampaignPopulationSection,
  CampaignReadinessSection,
} from "./campaign-launch-sections";

type TestUser = {
  fullName: string;
  effectivePermissions: Array<{ permissionKey: string; scope: string }>;
};

const state = vi.hoisted(() => ({
  user: {
    fullName: "HR Admin",
    effectivePermissions: [
      { permissionKey: "performance.cycle.manage", scope: "Tenant" },
    ],
  } as TestUser | null,
  routeParams: { slug: "fy26-planning-2026" },
  queryData: undefined as unknown,
  preview: undefined as unknown,
  readiness: undefined as unknown,
  queryError: null as Error | null,
  mutationMode: "idle" as "idle" | "success" | "conflict",
  mutationCalls: [] as unknown[],
  routerPush: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useParams: () => state.routeParams,
  useRouter: () => ({ push: state.routerPush }),
}));

vi.mock("next/link", () => ({
  default: ({ href, children, className }: { href: string; children: React.ReactNode; className?: string }) => (
    <a href={href} className={className}>
      {children}
    </a>
  ),
}));

vi.mock("@repo/auth", () => ({
  useAuth: () => ({
    user: state.user,
    isLoading: false,
  }),
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
      put: vi.fn(),
    }),
  };
});

vi.mock("@repo/api/query", () => ({
  useApiQueryClient: () => ({
    setQueryData: vi.fn(),
    invalidateQueries: vi.fn(),
  }),
  useApiQuery: (queryKey: unknown) => {
    const key = JSON.stringify(queryKey ?? []);
    if (key.includes("readiness")) {
      return { data: state.readiness, isLoading: state.readiness === undefined, isFetching: false, error: null, refetch: vi.fn(), invalidate: vi.fn() };
    }
    if (key.includes("population-preview")) {
      return { data: state.preview, isLoading: false, isFetching: false, error: null, refetch: vi.fn(), invalidate: vi.fn() };
    }
    if (key.includes("coreWorkforce") && key.includes("org-units")) {
      return { data: [], isLoading: false, isFetching: false, error: null, refetch: vi.fn(), invalidate: vi.fn() };
    }
    if (key.includes("coreWorkforce") && key.includes("search")) {
      return { data: { items: [] }, isLoading: false, isFetching: false, error: null, refetch: vi.fn(), invalidate: vi.fn() };
    }
    return {
      data: state.queryData,
      isLoading: false,
      isFetching: false,
      error: state.queryError,
      refetch: vi.fn(),
      invalidate: vi.fn(),
    };
  },
  useApiMutation: (_mutationFn: unknown, options?: {
    onSuccess?: (data: unknown, args: unknown) => void | Promise<void>;
    onError?: (error: Error, args: unknown) => void | Promise<void>;
  }) => ({
    mutate: (args: unknown) => {
      state.mutationCalls.push(args);
      if (state.mutationMode === "conflict") {
        const error = new (class ApiError extends Error {
          status = 409;
          errors = ["Conflict"];
        })("Conflict");
        void options?.onError?.(error, args);
        return;
      }
      if (state.mutationMode === "success") {
        void options?.onSuccess?.(state.queryData, args);
      }
    },
    mutateAsync: vi.fn(),
    data: undefined,
    error: null,
    isLoading: false,
    reset: vi.fn(),
  }),
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
    ],
  };
  state.queryData = undefined;
  state.preview = undefined;
  state.readiness = undefined;
  state.queryError = null;
  state.mutationMode = "idle";
  state.mutationCalls = [];
  state.routerPush.mockReset();
});

function render(node: React.ReactNode) {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  act(() => root?.render(node));
  return container;
}

function campaignDetail(): PerformanceCycleDetailDto {
  return {
    id: "campaign-1",
    name: "FY26 Planning",
    slug: "fy26-planning-2026",
    description: "Plan objectives",
    purpose: "Plan objectives",
    referenceYear: 2026,
    ownerUserId: "user-1",
    ownerName: "HR Admin",
    type: "Annual",
    status: "Draft",
    periodStart: "2026-01-15T00:00:00Z",
    periodEnd: "2026-03-15T00:00:00Z",
    objectiveSettingDeadline: "2026-02-15T00:00:00Z",
    planningOpeningDate: "2026-01-15T00:00:00Z",
    employeeSubmissionDeadline: "2026-02-15T00:00:00Z",
    managerApprovalDeadline: "2026-03-01T00:00:00Z",
    expectedPlanningLockDate: "2026-03-15T00:00:00Z",
    deadlineState: "None",
    populationIncludeInactive: false,
    participantCount: 0,
    launchedAt: null,
    closedAt: null,
    createdAt: "2026-01-01T00:00:00Z",
    updatedAt: null,
    version: 7,
    populationRules: [],
    planningRulesSnapshot: {
      maxObjectiveCount: 5,
      allowedWeightMenu: "[25,50,75,100]",
      enabledMeasurementMethods: "Quantitative,Qualitative",
      sourceConfigurationVersionId: "config-version-1",
      capturedAt: "2026-01-01T00:00:00Z",
    },
    strategicObjectives: [
      {
        id: "objective-1",
        title: "Improve client delivery",
        description: null,
        responsibleFunctionLabel: "Consulting",
        isActive: true,
        version: 1,
      },
    ],
    draftCompleteness: {
      isComplete: true,
      blockingReasons: [],
    },
  };
}

describe("Campaigns workspace", () => {
  it("renders the campaign list with product terminology", () => {
    state.queryData = {
      items: [
        {
          id: "campaign-1",
          name: "FY26 Planning",
          slug: "fy26-planning-2026",
          referenceYear: 2026,
          type: "Annual",
          status: "Draft",
          periodStart: "2026-01-15T00:00:00Z",
          periodEnd: "2026-03-15T00:00:00Z",
          objectiveSettingDeadline: null,
          deadlineState: "None",
          participantCount: 0,
    launchedAt: null,
          closedAt: null,
          createdAt: "2026-01-01T00:00:00Z",
          version: 1,
        },
      ],
      totalCount: 1,
      page: 1,
      pageSize: 50,
      totalPages: 1,
      hasNextPage: false,
      hasPreviousPage: false,
    };

    const page = render(<CampaignListPage />);

    expect(page.textContent).toContain("Campaigns");
    expect(page.textContent).toContain("FY26 Planning");
    expect(page.textContent).not.toContain("Cycle");
    expect(page.querySelector('a[href="/campaigns/fy26-planning-2026"]')).toBeTruthy();
  });

  it("mints a campaign through the create dialog and routes to its workspace", () => {
    state.queryData = campaignDetail();
    state.mutationMode = "success";

    render(<CampaignCreateDialog open onOpenChange={() => {}} />);
    const name = document.body.querySelector("#campaign-name") as HTMLInputElement;
    setInputValue(name, "FY26 Planning");
    const form = document.body.querySelector("form") as HTMLFormElement;

    act(() => {
      form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    });

    expect(state.mutationCalls).toHaveLength(1);
    expect(state.mutationCalls[0]).toMatchObject({ name: "FY26 Planning" });
    expect(state.routerPush).toHaveBeenCalledWith("/campaigns/fy26-planning-2026");
  });

  it("discards a draft campaign and returns to the list", () => {
    state.queryData = campaignDetail();
    state.mutationMode = "success";

    const page = render(<CampaignDraftPage />);
    const openButton = Array.from(page.querySelectorAll("button")).find((button) =>
      button.textContent?.includes("Discard campaign"),
    ) as HTMLButtonElement;
    act(() => openButton.click());

    // The confirm action (also "Discard campaign") renders in a portal appended to the body.
    const confirmButton = Array.from(document.body.querySelectorAll("button"))
      .filter((button) => button.textContent?.trim() === "Discard campaign")
      .pop() as HTMLButtonElement;
    act(() => confirmButton.click());

    expect(state.routerPush).toHaveBeenCalledWith("/campaigns");
  });

  it("shows date-order validation without losing entered values", () => {
    state.queryData = {
      ...campaignDetail(),
      managerApprovalDeadline: "2026-02-01T00:00:00Z",
    };

    const page = render(<CampaignDraftPage />);
    const managerApproval = page.querySelectorAll('input[type="date"]')[2] as HTMLInputElement;

    expect(page.textContent).toContain("Must be on or after employee submission.");
    expect(managerApproval.value).toBe("2026-02-01");
  });

  it("submits dirty Draft changes through the campaign mutation", () => {
    state.queryData = campaignDetail();
    state.mutationMode = "success";

    const page = render(<CampaignDraftPage />);
    const name = page.querySelector('input:not([type="date"])') as HTMLInputElement;
    setInputValue(name, "FY26 Planning Updated");
    const saveButton = Array.from(page.querySelectorAll("button")).find((button) =>
      button.textContent?.includes("Save changes"),
    ) as HTMLButtonElement;

    act(() => saveButton.click());

    expect(state.mutationCalls).toHaveLength(1);
    expect(state.mutationCalls[0]).toMatchObject({ name: "FY26 Planning Updated" });
  });

  it("surfaces stale conflict without dropping edited Draft values", () => {
    state.queryData = campaignDetail();
    state.mutationMode = "conflict";

    const page = render(<CampaignDraftPage />);
    const name = page.querySelector('input:not([type="date"])') as HTMLInputElement;
    setInputValue(name, "FY26 Planning Updated");
    const saveButton = Array.from(page.querySelectorAll("button")).find((button) =>
      button.textContent?.includes("Save changes"),
    ) as HTMLButtonElement;

    act(() => saveButton.click());

    expect(page.textContent).toContain("This campaign changed.");
    expect(name.value).toBe("FY26 Planning Updated");
  });

  it("renders view-only users in read-only mode", () => {
    state.user = {
      fullName: "Viewer",
      effectivePermissions: [
        { permissionKey: "performance.cycle.view", scope: "Tenant" },
      ],
    };
    state.queryData = campaignDetail();

    const page = render(<CampaignDraftPage />);

    expect(page.textContent).toContain("Read only");
    expect(page.textContent).not.toContain("Save changes");
    expect(page.textContent).toContain("Planning rules");
    expect(page.textContent).toContain("Quantitative");
    expect(page.textContent).toContain("Qualitative");
  });
});

const noop = () => Promise.resolve();

function readiness(overrides: Record<string, unknown> = {}) {
  return {
    canLaunch: true,
    isAllActiveBaseline: true,
    includedCount: 3,
    participants: [
      {
        employeeId: "e1",
        fullName: "Alice Martin",
        orgUnitName: "Consulting",
        jobTitle: "Consultant",
        approverEmployeeId: "m1",
        approverName: "Dana Lee",
        isApproverOverridden: false,
        approverOverrideReason: null,
        hasApprover: true,
      },
    ],
    exclusions: [],
    blockingConditions: [],
    informationalConditions: [],
    ...overrides,
  };
}

describe("Campaign population, readiness and launch", () => {
  it("shows the explicit all-active baseline when no org-unit scope is set", () => {
    const page = render(
      <CampaignPopulationSection campaign={campaignDetail()} canManage onSaved={noop} />,
    );
    expect(page.textContent).toContain("All active employees");
  });

  it("requires a reason for each exclusion before saving", () => {
    const campaign = {
      ...campaignDetail(),
      populationRules: [
        { ruleType: "ExcludeEmployee" as const, refId: "e9", includeDescendants: false, reason: "" },
      ],
    };
    const page = render(<CampaignPopulationSection campaign={campaign} canManage onSaved={noop} />);
    expect(page.textContent).toContain("A reason is required to exclude someone.");
  });

  it("presents a readiness-clear campaign as ready to launch and enables launch for operators", () => {
    state.user = {
      fullName: "HR Ops",
      effectivePermissions: [
        { permissionKey: "performance.cycle.manage", scope: "Tenant" },
        { permissionKey: "performance.cycle.publish", scope: "Tenant" },
      ],
    };
    state.readiness = readiness();

    const page = render(
      <CampaignReadinessSection campaign={campaignDetail()} canManage canOperate onChanged={noop} />,
    );

    expect(page.textContent).toContain("Ready to launch");
    const launch = Array.from(page.querySelectorAll("button")).find((button) =>
      button.textContent?.includes("Launch campaign"),
    ) as HTMLButtonElement;
    expect(launch).toBeTruthy();
    expect(launch.disabled).toBe(false);
  });

  it("blocks launch and foregrounds blocking conditions", () => {
    state.readiness = readiness({
      canLaunch: false,
      blockingConditions: [
        { code: "MissingApprover", severity: "Blocking", message: "Alice Martin has no approver.", employeeId: "e1" },
      ],
    });

    const page = render(
      <CampaignReadinessSection campaign={campaignDetail()} canManage canOperate onChanged={noop} />,
    );

    expect(page.textContent).toContain("Not ready yet");
    expect(page.textContent).toContain("Alice Martin has no approver.");
    const launch = Array.from(page.querySelectorAll("button")).find((button) =>
      button.textContent?.includes("Launch campaign"),
    ) as HTMLButtonElement;
    expect(launch.disabled).toBe(true);
    expect(page.textContent).toContain("Resolve the items above to launch.");
  });

  it("launch confirmation states the resolved participant count", () => {
    state.readiness = readiness({ includedCount: 3 });

    const page = render(
      <CampaignReadinessSection campaign={campaignDetail()} canManage canOperate onChanged={noop} />,
    );
    const launch = Array.from(page.querySelectorAll("button")).find((button) =>
      button.textContent?.includes("Launch campaign"),
    ) as HTMLButtonElement;
    act(() => launch.click());

    expect(document.body.textContent).toContain("Launch this campaign?");
    expect(document.body.textContent).toContain("3 participants");
  });

  it("hides the launch action from users without the operate permission", () => {
    state.readiness = readiness();

    const page = render(
      <CampaignReadinessSection campaign={campaignDetail()} canManage canOperate={false} onChanged={noop} />,
    );

    expect(page.textContent).not.toContain("Launch campaign");
  });
});

function setInputValue(input: HTMLInputElement, value: string) {
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
  act(() => {
    setter?.call(input, value);
    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.dispatchEvent(new Event("change", { bubbles: true }));
  });
}
