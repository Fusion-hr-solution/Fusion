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
}));

vi.mock("@repo/api/query", async () => {
  const actual =
    await vi.importActual<typeof import("@repo/api/query")>("@repo/api/query");
  return actual;
});

import { ApiQueryProvider, createApiQueryClient } from "@repo/api/query";
import { useEmployeeRoster } from "./use-employees";

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

describe("useEmployeeRoster", () => {
  it("calls the employee list endpoint with the roster query params", async () => {
    const mockData = {
      items: [],
      totalCount: 0,
      page: 1,
      pageSize: 20,
      totalPages: 0,
      hasNextPage: false,
      hasPreviousPage: false,
    };
    mockGet.mockResolvedValue(mockData);

    const { result } = renderHook(
      () =>
        useEmployeeRoster({
          search: "pat",
          status: "Active",
          sortBy: "HireDate",
          sortDir: "Desc",
          page: 2,
          pageSize: 25,
        }),
      { wrapper: createWrapper() }
    );

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(mockGet).toHaveBeenCalledWith(
      "/corehr/employees",
      expect.objectContaining({
        params: expect.objectContaining({
          search: "pat",
          status: "Active",
          sortBy: "HireDate",
          sortDir: "Desc",
          page: 2,
          pageSize: 25,
        }),
        signal: expect.any(AbortSignal),
      })
    );
    expect(result.current.data).toEqual(mockData);
  });

  it("omits an empty search string from the request", async () => {
    mockGet.mockResolvedValue({
      items: [],
      totalCount: 0,
      page: 1,
      pageSize: 20,
      totalPages: 0,
      hasNextPage: false,
      hasPreviousPage: false,
    });

    renderHook(
      () =>
        useEmployeeRoster({
          search: "   ",
          sortBy: "Name",
          sortDir: "Asc",
          page: 1,
          pageSize: 20,
        }),
      { wrapper: createWrapper() }
    );

    await waitFor(() => expect(mockGet).toHaveBeenCalled());

    const [, options] = mockGet.mock.calls[0]!;
    expect(options.params.search).toBeUndefined();
  });

  it("surfaces orgUnitId and orgUnitName from the API response", async () => {
    const mockData = {
      items: [
        {
          id: "emp-1",
          firstName: "Sarah",
          lastName: "Chen",
          email: "sarah.chen@ey-hr.com",
          orgUnitId: "ou-1",
          orgUnitName: "Backend Team",
          jobTitle: "Senior Software Engineer",
          status: "Active",
          hireDate: "2023-01-15T00:00:00Z",
          managerId: "mgr-1",
          managerName: "James Wilson",
        },
        {
          id: "emp-2",
          firstName: "Lisa",
          lastName: "Brown",
          email: "lisa.brown@ey-hr.com",
          orgUnitId: null,
          orgUnitName: null,
          jobTitle: "Finance Director",
          status: "Active",
          hireDate: "2020-11-01T00:00:00Z",
          managerId: null,
          managerName: null,
        },
      ],
      totalCount: 2,
      page: 1,
      pageSize: 20,
      totalPages: 1,
      hasNextPage: false,
      hasPreviousPage: false,
    };
    mockGet.mockResolvedValue(mockData);

    const { result } = renderHook(
      () =>
        useEmployeeRoster({
          sortBy: "Name",
          sortDir: "Asc",
          page: 1,
          pageSize: 20,
        }),
      { wrapper: createWrapper() }
    );

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    const items = result.current.data?.items ?? [];
    expect(items[0]?.orgUnitId).toBe("ou-1");
    expect(items[0]?.orgUnitName).toBe("Backend Team");
    expect(items[1]?.orgUnitId).toBeNull();
    expect(items[1]?.orgUnitName).toBeNull();
  });
});
