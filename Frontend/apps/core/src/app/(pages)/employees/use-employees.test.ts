// @vitest-environment happy-dom
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { createElement, type PropsWithChildren } from "react";

const { mockDelete, mockGet, mockPost, mockPut } = vi.hoisted(() => ({
  mockDelete: vi.fn(),
  mockGet: vi.fn(),
  mockPost: vi.fn(),
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

const tenantContextState = vi.hoisted(() => ({
  tenantId: null as string | null,
  tenantName: null as string | null,
  tenantStatus: null as string | null,
  isActive: false,
  isArchived: false,
  isReady: false,
  isLoading: false,
  setTenant: vi.fn(),
  clearTenant: vi.fn(),
}));

vi.mock("@repo/api", () => ({
  createPlatformApiClient: () => ({
    delete: mockDelete,
    get: mockGet,
    post: mockPost,
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

vi.mock("@/shell/tenant-context/core-tenant-context-provider", () => ({
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

vi.mock("@/lib/employee-roster-access", () => ({
  canAccessEmployeeProfile: () => true,
  canAccessEmployeeRoster: () => true,
  canAccessTeamWorkspace: () => true,
}));

import { ApiQueryProvider, createApiQueryClient } from "@repo/api/query";
import {
  useCreateEmployeeRecord,
  useTerminateEmployee,
  useRehireEmployee,
  useEmployeeDetails,
  useEmployeeOrgUnitOptions,
  useEmployeeManagerOptions,
  useEmployeeReportingLines,
  useEmployeeRoster,
  useUpdateMyProfile,
  useWorkforceReadinessSummary,
  useUpdateEmployeeRecord,
  useChangeEmployeeManager,
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
  tenantContextState.tenantId = null;
  tenantContextState.tenantName = null;
  tenantContextState.tenantStatus = null;
  tenantContextState.isActive = false;
  tenantContextState.isArchived = false;
  tenantContextState.isReady = false;
  tenantContextState.isLoading = false;
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

describe("useEmployeeManagerOptions", () => {
  it("searches active employees for manager options", async () => {
    mockGet.mockResolvedValue({
      items: [],
      totalCount: 0,
      page: 1,
      pageSize: 100,
      totalPages: 0,
      hasNextPage: false,
      hasPreviousPage: false,
    });

    renderHook(
      () =>
        useEmployeeManagerOptions({
          employeeId: "emp-1",
          search: "jam",
        }),
      { wrapper: createWrapper() }
    );

    await waitFor(() => expect(mockGet).toHaveBeenCalled());

    expect(mockGet).toHaveBeenCalledWith(
      "/corehr/employees",
      expect.objectContaining({
        params: expect.objectContaining({
          search: "jam",
          status: "Active",
          sortBy: "Name",
          sortDir: "Asc",
          page: 1,
          pageSize: 100,
        }),
        signal: expect.any(AbortSignal),
      })
    );
  });

  it("loads manager options on open even before a search term is entered", async () => {
    mockGet.mockResolvedValue({
      items: [],
      totalCount: 0,
      page: 1,
      pageSize: 100,
      totalPages: 0,
      hasNextPage: false,
      hasPreviousPage: false,
    });

    renderHook(
      () =>
        useEmployeeManagerOptions({
          employeeId: null,
          search: "",
        }),
      { wrapper: createWrapper() }
    );

    await waitFor(() => expect(mockGet).toHaveBeenCalled());

    expect(mockGet).toHaveBeenCalledWith(
      "/corehr/employees",
      expect.objectContaining({
        params: expect.objectContaining({
          search: undefined,
          status: "Active",
          sortBy: "Name",
          sortDir: "Asc",
          page: 1,
          pageSize: 100,
        }),
        signal: expect.any(AbortSignal),
      })
    );
  });
});

describe("useEmployeeOrgUnitOptions", () => {
  it("loads active org units for the profile workspace", async () => {
    mockGet.mockResolvedValue({
      items: [],
      totalCount: 0,
      page: 1,
      pageSize: 100,
      totalPages: 0,
      hasNextPage: false,
      hasPreviousPage: false,
    });

    renderHook(() => useEmployeeOrgUnitOptions({ search: "Eng" }), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(mockGet).toHaveBeenCalled());

    expect(mockGet).toHaveBeenCalledWith(
      "/corehr/org-units",
      expect.objectContaining({
        params: expect.objectContaining({
          search: "Eng",
          isActive: true,
          sortBy: "Name",
          sortDir: "Asc",
          page: 1,
          pageSize: 100,
        }),
        signal: expect.any(AbortSignal),
      })
    );
  });
});

describe("useCreateEmployeeRecord", () => {
  it("posts a minimal create payload and omits empty optional fields", async () => {
    mockPost.mockResolvedValue({ id: "emp-7" });

    const { result } = renderHook(() => useCreateEmployeeRecord(), {
      wrapper: createWrapper(),
    });

    await result.current.mutateAsync({
      firstName: "  Alice  ",
      lastName: "  Smith  ",
      email: "  Alice.Smith@Example.com  ",
      hireDate: "2026-06-01T00:00:00.000Z",
      jobTitle: "   ",
    });

    expect(mockPost).toHaveBeenCalledWith(
      "/corehr/employees",
      {
        firstName: "Alice",
        lastName: "Smith",
        email: "alice.smith@example.com",
        hireDate: "2026-06-01T00:00:00.000Z",
      }
    );
  });
});

describe("useChangeEmployeeManager", () => {
  it("posts to the canonical change-manager endpoint with effectiveDate and If-Match", async () => {
    mockPost.mockResolvedValue({ id: "emp-1" });

    const { result } = renderHook(() => useChangeEmployeeManager(), {
      wrapper: createWrapper(),
    });

    await result.current.mutateAsync({
      employeeId: "emp-1",
      expectedVersion: 11,
      managerId: "mgr-2",
      effectiveDate: "2025-01-01T00:00:00.000Z",
    });

    expect(mockPost).toHaveBeenCalledWith(
      "/corehr/employees/emp-1/change-manager",
      { managerId: "mgr-2", effectiveDate: "2025-01-01T00:00:00.000Z" },
      {
        headers: {
          "If-Match": '"11"',
        },
      }
    );
  });
});

describe("useUpdateEmployeeRecord", () => {
  it("sends targeted profile updates with optimistic concurrency headers", async () => {
    mockPut.mockResolvedValue({});

    const { result } = renderHook(() => useUpdateEmployeeRecord(), {
      wrapper: createWrapper(),
    });

    await result.current.mutateAsync({
      employeeId: "emp-1",
      expectedVersion: 7,
      firstName: "Alice",
      lastName: "Smith",
      email: "alice@example.com",
      jobTitle: "Principal Engineer",
      orgUnitId: null,
    });

    expect(mockPut).toHaveBeenCalledWith(
      "/corehr/employees/emp-1",
      {
        firstName: "Alice",
        lastName: "Smith",
        email: "alice@example.com",
        jobTitle: "Principal Engineer",
        orgUnitId: "00000000-0000-0000-0000-000000000000",
      },
      {
        headers: {
          "If-Match": '"7"',
        },
      }
    );
  });

  it("omits fields that are not part of the current sheet update", async () => {
    mockPut.mockResolvedValue({});

    const { result } = renderHook(() => useUpdateEmployeeRecord(), {
      wrapper: createWrapper(),
    });

    await result.current.mutateAsync({
      employeeId: "emp-1",
      expectedVersion: 8,
      firstName: "Alice",
      lastName: "Smith",
      email: "alice@example.com",
    });

    expect(mockPut).toHaveBeenCalledWith(
      "/corehr/employees/emp-1",
      {
        firstName: "Alice",
        lastName: "Smith",
        email: "alice@example.com",
      },
      {
        headers: {
          "If-Match": '"8"',
        },
      }
    );
  });

  it("only sends the organization field when updating org assignment", async () => {
    mockPut.mockResolvedValue({});

    const { result } = renderHook(() => useUpdateEmployeeRecord(), {
      wrapper: createWrapper(),
    });

    await result.current.mutateAsync({
      employeeId: "emp-1",
      expectedVersion: 9,
      orgUnitId: "org-7",
    });

    expect(mockPut).toHaveBeenCalledWith(
      "/corehr/employees/emp-1",
      {
        orgUnitId: "org-7",
      },
      {
        headers: {
          "If-Match": '"9"',
        },
      }
    );
  });
});

describe("useUpdateMyProfile", () => {
  it("sends preferred-name updates to the dedicated self-profile endpoint", async () => {
    mockPut.mockResolvedValue(undefined);

    const { result } = renderHook(() => useUpdateMyProfile(), {
      wrapper: createWrapper(),
    });

    await result.current.mutateAsync({
      employeeId: "emp-1",
      expectedVersion: 12,
      preferredName: "Sally",
    });

    expect(mockPut).toHaveBeenCalledWith(
      "/corehr/employees/emp-1/self-profile",
      {
        preferredName: "Sally",
      },
      {
        headers: {
          "If-Match": '"12"',
        },
      }
    );
  });
});

describe("useTerminateEmployee", () => {
  it("posts to the terminate endpoint with effectiveDate and If-Match", async () => {
    mockPost.mockResolvedValue({ id: "emp-1" });

    const { result } = renderHook(() => useTerminateEmployee(), {
      wrapper: createWrapper(),
    });

    await result.current.mutateAsync({
      employeeId: "emp-1",
      expectedVersion: 11,
      effectiveDate: "2025-12-31T00:00:00.000Z",
      note: "Voluntary resignation",
    });

    expect(mockPost).toHaveBeenCalledWith(
      "/corehr/employees/emp-1/terminate",
      { effectiveDate: "2025-12-31T00:00:00.000Z", note: "Voluntary resignation" },
      {
        headers: {
          "If-Match": '"11"',
        },
      }
    );
  });
});

describe("useRehireEmployee", () => {
  it("posts to the rehire endpoint with required fields and If-Match", async () => {
    mockPost.mockResolvedValue({ id: "emp-1" });

    const { result } = renderHook(() => useRehireEmployee(), {
      wrapper: createWrapper(),
    });

    await result.current.mutateAsync({
      employeeId: "emp-1",
      expectedVersion: 5,
      effectiveDate: "2026-01-06T00:00:00.000Z",
      orgUnitId: "ou-1",
      jobTitle: "Senior Engineer",
    });

    expect(mockPost).toHaveBeenCalledWith(
      "/corehr/employees/emp-1/rehire",
      {
        effectiveDate: "2026-01-06T00:00:00.000Z",
        orgUnitId: "ou-1",
        jobTitle: "Senior Engineer",
        workLocation: null,
        managerId: null,
        employmentType: null,
      },
      {
        headers: {
          "If-Match": '"5"',
        },
      }
    );
  });
});

describe("useEmployeeDetails", () => {
  it("calls the composed employee details endpoint for the given employee", async () => {
    const mockDetails = {
      id: "emp-1",
      tenantId: "tenant-1",
      stableEmployeeKey: "E-EMP1",
      employeeNumber: "E-001",
      firstName: "Alice",
      lastName: "Smith",
      preferredName: "Ali",
      displayName: "Ali Smith",
      fullName: "Alice Smith",
      email: "alice@example.com",
      phone: "+216 20 000 000",
      currentEmployment: {
        employmentId: "employment-1",
        effectiveFrom: "2021-06-01T00:00:00Z",
        effectiveTo: null,
        status: "Active",
        employmentType: "Full-time",
      },
      currentWorkAssignment: {
        workAssignmentId: "assignment-1",
        employmentId: "employment-1",
        orgUnitId: "org-1",
        orgUnitName: "Engineering",
        orgUnitType: "Department",
        jobTitle: "Senior Engineer",
        workLocation: "Tunis",
        isPrimary: true,
        effectiveFrom: "2021-06-01T00:00:00Z",
        effectiveTo: null,
      },
      currentManager: {
        relationshipId: "manager-1",
        managerEmployeeId: "mgr-1",
        managerWorkAssignmentId: "assignment-2",
        managerFirstName: "Bob",
        managerLastName: "Jones",
        managerEmail: "bob@example.com",
        effectiveFrom: "2021-06-01T00:00:00Z",
        effectiveTo: null,
        managerFullName: "Bob Jones",
      },
      historySummary: {
        employmentCount: 1,
        workAssignmentCount: 1,
        managerRelationshipCount: 1,
      },
      readiness: {
        employeeStateIssueCount: 0,
        blockingIssueCount: 0,
        employeeStateIssues: [],
        blockingIssues: [],
        hasEmployeeStateIssues: false,
        hasBlockingIssues: false,
      },
      createdAt: "2021-06-01T00:00:00Z",
      updatedAt: "2024-06-01T00:00:00Z",
      version: 9,
    };

    mockGet.mockResolvedValue(mockDetails);

    const { result } = renderHook(() => useEmployeeDetails("E-EMP1"), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(mockGet).toHaveBeenCalledWith(
      "/corehr/employees/by-key/E-EMP1",
      expect.objectContaining({ signal: expect.any(AbortSignal) })
    );
    expect(result.current.data).toMatchObject({
      id: "emp-1",
      fullName: "Alice Smith",
      currentEmployment: {
        status: "Active",
      },
      currentWorkAssignment: {
        orgUnitName: "Engineering",
      },
    });
  });

  it("does not fetch when employeeId is null", async () => {
    const { result } = renderHook(() => useEmployeeDetails(null), {
      wrapper: createWrapper(),
    });

    await new Promise((r) => setTimeout(r, 50));
    expect(mockGet).not.toHaveBeenCalled();
    expect(result.current.data).toBeUndefined();
  });
});
