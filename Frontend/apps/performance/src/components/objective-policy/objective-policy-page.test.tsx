// @vitest-environment happy-dom
import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { createElement, type PropsWithChildren } from "react";
import type * as RepoApi from "@repo/api";

const { mockGet } = vi.hoisted(() => ({
  mockGet: vi.fn(),
}));

const authState = vi.hoisted(() => ({
  user: { userId: "u1", email: "hr@example.com", fullName: "HR", roles: ["HRAdmin"] },
  isLoading: false,
}));

const access = vi.hoisted(() => ({ perms: new Set<string>() }));

vi.mock("@repo/api", async () => {
  const actual = await vi.importActual<typeof RepoApi>("@repo/api");
  return {
    ...actual,
    createPlatformApiClient: () => ({ get: mockGet }),
  };
});

vi.mock("@repo/auth", () => ({
  useAuth: () => authState,
  hasCorePermission: (_user: unknown, perm: string) => access.perms.has(perm),
}));

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

// Child views own their own concerns; stub them so page state logic is isolated.
vi.mock("./policy-apply-editor", () => ({ PolicyApplyEditor: () => createElement("div", null, "Policy apply editor") }));
vi.mock("./policy-version-detail", () => ({ PolicyVersionDetail: () => null }));
vi.mock("./policy-history", () => ({ PolicyHistory: () => null }));

import { ApiError } from "@repo/api";
import { ApiQueryProvider, createApiQueryClient } from "@repo/api/query";
import { ObjectivePolicyPage } from "./objective-policy-page";

function createWrapper() {
  const client = createApiQueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  function TestQueryProvider({ children }: PropsWithChildren) {
    return createElement(ApiQueryProvider, { client }, children);
  }
  TestQueryProvider.displayName = "TestQueryProvider";
  return TestQueryProvider;
}

function version(overrides: Record<string, unknown> = {}) {
  return {
    id: "v1",
    versionNumber: 2,
    status: "Active",
    maxObjectivesPerPlan: 7,
    allowedWeightValues: "5,10,15,20,25,30,40,50",
    managerValidationSlaDays: 10,
    cascadeMode: "Optional",
    measurementTypes: "Quantitative,Qualitative",
    attachmentsEnabled: true,
    version: 3,
    ...overrides,
  };
}

const VIEW = "performance.objective.policy.view";
const MANAGE = "performance.objective.policy.manage";

beforeEach(() => {
  vi.clearAllMocks();
  authState.isLoading = false;
  access.perms = new Set([VIEW, MANAGE]);
});

function renderPage() {
  render(createElement(ObjectivePolicyPage), { wrapper: createWrapper() });
}

describe("ObjectivePolicyPage states", () => {
  it("shows a permission notice when the user cannot view policy", () => {
    access.perms = new Set();
    renderPage();
    expect(screen.getByText("Access restricted")).not.toBeNull();
  });

  it("shows the current active policy", async () => {
    mockGet.mockResolvedValue({ currentPolicy: version() });
    renderPage();
    await screen.findByText("Current policy");
    expect(screen.getByText("Active")).not.toBeNull();
  });

  it("shows a not-provisioned setup state and gates it behind manage permission", async () => {
    mockGet.mockRejectedValue(new ApiError(404, "Not Found", ["No policy"], null));
    access.perms = new Set([VIEW]); // view only
    renderPage();
    await screen.findByText(/No objective policy has been provisioned/);
    expect(screen.queryByRole("button", { name: "Set up policy" })).toBeNull();
  });

  it("shows a recoverable load error rather than a false setup state on 500", async () => {
    mockGet.mockRejectedValue(new ApiError(500, "Server Error", ["boom"], null));
    renderPage();
    await screen.findByText("Couldn't load the objective policy");
    // Must not masquerade as an un-provisioned tenant.
    expect(screen.queryByText(/No objective policy has been set up/)).toBeNull();
    expect(screen.getByRole("button", { name: "Try again" })).not.toBeNull();
  });

  it("disables editing the active policy without manage permission", async () => {
    mockGet.mockResolvedValue({ currentPolicy: version() });
    access.perms = new Set([VIEW]);
    renderPage();
    await screen.findByText("Current policy");
    expect((screen.getByRole("button", { name: /Edit policy/ }) as HTMLButtonElement).disabled).toBe(true);
  });

  it("opens local editing without creating persisted policy state", async () => {
    mockGet.mockResolvedValue({ currentPolicy: version() });
    renderPage();
    await screen.findByText("Current policy");

    fireEvent.click(screen.getByRole("button", { name: /Edit policy/ }));

    expect(await screen.findByText("Policy apply editor")).not.toBeNull();
  });
});
