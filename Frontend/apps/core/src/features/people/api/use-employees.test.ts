// @vitest-environment happy-dom
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { createElement, type PropsWithChildren } from "react";

const { mockGet, mockPut } = vi.hoisted(() => ({
  mockGet: vi.fn(),
  mockPut: vi.fn(),
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
    put: mockPut,
  }),
}));

vi.mock("@repo/auth", () => ({
  useAuth: () => authState,
  canAccessCorePeople: (user: { roles?: string[] } | null) =>
    !!user?.roles?.includes("HRAdmin") &&
    !user?.roles?.includes("PlatformAdmin"),
  canAccessCoreTeam: (user: { employeeId?: string | null; roles?: string[] } | null) =>
    !!user?.employeeId && !!user.roles?.includes("Manager"),
  canAccessOwnCoreProfile: (user: { employeeId?: string | null } | null) =>
    !!user?.employeeId,
}));

vi.mock("@repo/api/query", async () => {
  const actual = await vi.importActual("@repo/api/query");
  return actual;
});

vi.mock("@/lib/employee-roster-access", () => ({
  canAccessEmployeeProfile: () => true,
  canAccessEmployeeRoster: () => true,
  canAccessTeamWorkspace: () => true,
}));

import { ApiQueryProvider, createApiQueryClient } from "@repo/api/query";
import {
  useEmployeeReportingLines,
  useEmployeeRoster,
  useWorkforceReadinessSummary,
} from "./use-employees";

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
          orgUnitId: "ou-1",
          managerId: "mgr-7",
          access: "NotInvited",
          readiness: "MissingOrgUnit",
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
          orgUnitId: "ou-1",
          managerId: "mgr-7",
          access: "NotInvited",
          readiness: "MissingOrgUnit",
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

  it("calls the employee list endpoint with the readiness filter when provided", async () => {
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
          readiness: "DeactivationBlocked",
          sortBy: "Name",
          sortDir: "Asc",
          page: 1,
          pageSize: 20,
        }),
      { wrapper: createWrapper() }
    );

    await waitFor(() => expect(mockGet).toHaveBeenCalled());

    const [, options] = mockGet.mock.calls[0]!;
    expect(options.params.readiness).toBe("DeactivationBlocked");
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
          version: 3,
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
          version: 7,
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

describe("useEmployeeReportingLines", () => {
  it("calls the reporting-lines endpoint for the selected employee", async () => {
    const mockData = {
      employee: {
        id: "emp-1",
        stableEmployeeKey: "E-EMP1",
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
        hierarchyStatus: "Healthy",
        directReportCount: 2,
        version: 11,
      },
      managerChain: [],
      directReports: [],
      downline: [],
      directReportCount: 2,
      downlineCount: 2,
    };
    mockGet.mockResolvedValue(mockData);

    const { result } = renderHook(() => useEmployeeReportingLines("E-EMP1"), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(mockGet).toHaveBeenCalledWith(
      "/corehr/employees/by-key/E-EMP1/reporting-lines",
      expect.objectContaining({
        signal: expect.any(AbortSignal),
      })
    );
    expect(result.current.data).toEqual(mockData);
  });
});

describe("useWorkforceReadinessSummary", () => {
  it("calls the readiness summary endpoint", async () => {
    const mockData = {
      activeEmployeeCount: 12,
      readyEmployeeCount: 9,
      employeesNeedingAttention: 4,
      readinessScore: 75,
      issueCounts: {
        missingRequiredFields: 1,
        missingOrgUnit: 1,
        noManagerAssigned: 1,
        managerInactive: 0,
        managerMissing: 0,
        deactivationBlocked: 2,
        unresolvedImportIssues: 3,
      },
    };
    mockGet.mockResolvedValue(mockData);

    const { result } = renderHook(() => useWorkforceReadinessSummary(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(mockGet).toHaveBeenCalledWith(
      "/corehr/employees/readiness-summary",
      expect.objectContaining({
        signal: expect.any(AbortSignal),
      })
    );
    expect(result.current.data).toEqual(mockData);
  });
});

