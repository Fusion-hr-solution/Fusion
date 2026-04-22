// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";

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
  canAccessCoreSetup: (user: { roles?: string[] } | null) =>
    !!user?.roles?.includes("HRAdmin") &&
    !user.roles.includes("PlatformAdmin"),
}));

vi.mock("@repo/api/react", async () => {
  const actual = await vi.importActual<typeof import("@repo/api/react")>(
    "@repo/api/react"
  );
  return actual;
});

import { useEmployeeRoster } from "./use-employees";

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

    const { result } = renderHook(() =>
      useEmployeeRoster({
        search: "pat",
        status: "Active",
        sortBy: "HireDate",
        sortDir: "Desc",
        page: 2,
        pageSize: 25,
      })
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

    renderHook(() =>
      useEmployeeRoster({
        search: "   ",
        sortBy: "Name",
        sortDir: "Asc",
        page: 1,
        pageSize: 20,
      })
    );

    await waitFor(() => expect(mockGet).toHaveBeenCalled());

    const [, options] = mockGet.mock.calls[0]!;
    expect(options.params.search).toBeUndefined();
  });

  it("does not fetch for users outside the HR admin roster contract", async () => {
    authState.user = {
      userId: "platform-1",
      email: "platform@example.com",
      fullName: "Platform Admin",
      roles: ["PlatformAdmin"],
    };

    const { result } = renderHook(() =>
      useEmployeeRoster({
        sortBy: "Name",
        sortDir: "Asc",
        page: 1,
        pageSize: 20,
      })
    );

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(mockGet).not.toHaveBeenCalled();
  });
});