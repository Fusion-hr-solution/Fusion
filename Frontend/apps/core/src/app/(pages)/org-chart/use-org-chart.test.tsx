// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { createElement, type PropsWithChildren } from "react";

const { mockGet } = vi.hoisted(() => ({
  mockGet: vi.fn(),
}));

const authState = vi.hoisted(() => ({
  isAuthenticated: true,
  user: {
    userId: "hr-1",
    email: "hr@example.com",
    fullName: "HR Admin",
    roles: ["HRAdmin"],
  },
}));

vi.mock("@repo/api", () => ({
  createPlatformApiClient: () => ({
    get: mockGet,
  }),
}));

vi.mock("@repo/auth", () => ({
  useAuth: () => authState,
  canAccessCorePeople: (user: { roles?: string[] } | null) =>
    !!user?.roles?.includes("HRAdmin") &&
    !user?.roles?.includes("PlatformAdmin"),
  canAccessCoreOrgChart: (user: { roles?: string[] } | null) =>
    !!user?.roles?.includes("HRAdmin") &&
    !user?.roles?.includes("PlatformAdmin"),
}));

vi.mock("@/components/core-tenant-context-provider", () => ({
  useTenantContext: () => ({
    tenantId: null,
    tenantSummary: null,
    isLoading: false,
    clearTenantContext: vi.fn(),
  }),
}));

vi.mock("@repo/api/query", async () => {
  const actual = await vi.importActual("@repo/api/query");
  return actual;
});

import { ApiQueryProvider, createApiQueryClient } from "@repo/api/query";
import { useOrgChart } from "./use-org-chart";

function createWrapper() {
  const client = createApiQueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  function TestQueryProvider({ children }: PropsWithChildren) {
    return createElement(ApiQueryProvider, { client }, children);
  }

  TestQueryProvider.displayName = "TestQueryProvider";

  return TestQueryProvider;
}

beforeEach(() => {
  vi.clearAllMocks();
  authState.isAuthenticated = true;
  authState.user = {
    userId: "hr-1",
    email: "hr@example.com",
    fullName: "HR Admin",
    roles: ["HRAdmin"],
  };
});

describe("useOrgChart", () => {
  it("calls the dedicated org-chart endpoint with the requested root and depth", async () => {
    mockGet.mockResolvedValue({
      roots: [],
      requestedRootEmployeeId: "emp-7",
      maxDepthApplied: 8,
      includeInactive: false,
      totalVisibleNodeCount: 0,
      isTruncated: false,
    });

    const { result } = renderHook(
      () => useOrgChart({ rootEmployeeId: "emp-7", maxDepth: 8 }),
      { wrapper: createWrapper() }
    );

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(mockGet).toHaveBeenCalledWith(
      "/corehr/employees/org-chart",
      expect.objectContaining({
        params: {
          rootEmployeeId: "emp-7",
          maxDepth: 8,
          includeInactive: undefined,
        },
        signal: expect.any(AbortSignal),
      })
    );
  });

  it("forwards includeInactive when explicitly enabled", async () => {
    mockGet.mockResolvedValue({
      roots: [],
      requestedRootEmployeeId: null,
      maxDepthApplied: 10,
      includeInactive: true,
      totalVisibleNodeCount: 0,
      isTruncated: false,
    });

    renderHook(() => useOrgChart({ includeInactive: true }), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(mockGet).toHaveBeenCalled());

    expect(mockGet).toHaveBeenCalledWith(
      "/corehr/employees/org-chart",
      expect.objectContaining({
        params: expect.objectContaining({
          includeInactive: true,
          maxDepth: 10,
        }),
      })
    );
  });
});
