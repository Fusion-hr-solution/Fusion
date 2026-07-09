// @vitest-environment happy-dom

import React from "react";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CampaignDraftPage, CampaignListPage } from "./campaigns-page";
import { CampaignCreateDialog } from "./campaign-create-dialog";

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
    data: state.queryData,
    isLoading: false,
    isFetching: false,
    error: state.queryError,
    refetch: vi.fn(),
    invalidate: vi.fn(),
  }),
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

function campaignDetail() {
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
    publishedAt: null,
    activatedAt: null,
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
          publishedAt: null,
          activatedAt: null,
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

function setInputValue(input: HTMLInputElement, value: string) {
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
  act(() => {
    setter?.call(input, value);
    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.dispatchEvent(new Event("change", { bubbles: true }));
  });
}
