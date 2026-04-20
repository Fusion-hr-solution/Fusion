// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";

// ── Mocks ────────────────────────────────────────────────────────────
// vi.mock is hoisted by Vitest, so mocks must be created via vi.hoisted
// to avoid TDZ (temporal dead zone) ReferenceErrors.
const { mockGet, mockPost, mockPatch } = vi.hoisted(() => ({
  mockGet: vi.fn(),
  mockPost: vi.fn(),
  mockPatch: vi.fn(),
}));

const authState = vi.hoisted(() => ({
  isAuthenticated: true,
  user: {
    userId: "platform-1",
    email: "platform@example.com",
    fullName: "Platform Admin",
    roles: ["PlatformAdmin"],
  },
}));

vi.mock("@repo/api", () => ({
  createPlatformApiClient: () => ({
    get: mockGet,
    post: mockPost,
    patch: mockPatch,
  }),
  platformOrganizationsPaths: {
    list: () => "/identity/platform-admin/organizations",
    detail: (id: string) => `/identity/platform-admin/organizations/${id}`,
    create: () => "/identity/platform-admin/organizations",
    update: (id: string) => `/identity/platform-admin/organizations/${id}`,
    suspend: (id: string) =>
      `/identity/platform-admin/organizations/${id}/suspend`,
    reactivate: (id: string) =>
      `/identity/platform-admin/organizations/${id}/reactivate`,
    archive: (id: string) =>
      `/identity/platform-admin/organizations/${id}/archive`,
    resendFirstAdmin: (id: string) =>
      `/identity/platform-admin/organizations/${id}/first-admin-invite/resend`,
    revokeFirstAdmin: (id: string) =>
      `/identity/platform-admin/organizations/${id}/first-admin-invite/revoke`,
  },
}));

vi.mock("@repo/auth", () => ({
  useAuth: () => authState,
  canAccessOrganizations: (user: { roles?: string[] } | null) =>
    !!user?.roles?.includes("PlatformAdmin"),
}));

// Re-export real implementations from @repo/api/react
// The hooks are lightweight, so we use the real useApiQuery/useApiMutation
vi.mock("@repo/api/react", async () => {
  const actual = await vi.importActual<typeof import("@repo/api/react")>(
    "@repo/api/react"
  );
  return actual;
});

import {
  useOrganizationList,
  useOrganizationDetail,
  useCreateOrganization,
  useUpdateOrganization,
  useSuspendOrganization,
  useReactivateOrganization,
  useArchiveOrganization,
  useResendFirstAdminInvite,
  useRevokeFirstAdminInvite,
} from "./use-organizations";

// ── Setup ────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks();
  authState.isAuthenticated = true;
  authState.user = {
    userId: "platform-1",
    email: "platform@example.com",
    fullName: "Platform Admin",
    roles: ["PlatformAdmin"],
  };
});

// ── Query hooks ──────────────────────────────────────────────────────

describe("useOrganizationList", () => {
  it("calls client.get with correct path and query params", async () => {
    const mockData = { items: [], totalCount: 0, stats: {} };
    mockGet.mockResolvedValue(mockData);

    const { result } = renderHook(() =>
      useOrganizationList({
        skip: 0,
        take: 20,
        search: "acme",
        orderBy: "name",
        orderDirection: "asc",
      })
    );

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(mockGet).toHaveBeenCalledWith(
      "/identity/platform-admin/organizations",
      expect.objectContaining({
        params: expect.objectContaining({
          skip: 0,
          take: 20,
          search: "acme",
          orderBy: "name",
          orderDirection: "asc",
        }),
      })
    );
    expect(result.current.data).toEqual(mockData);
  });

  it("appends filterByStatus as query string params", async () => {
    mockGet.mockResolvedValue({ items: [], totalCount: 0, stats: {} });

    renderHook(() =>
      useOrganizationList({
        skip: 0,
        take: 20,
        filterByStatus: ["active", "suspended"],
      })
    );

    await waitFor(() => expect(mockGet).toHaveBeenCalled());

    const [path] = mockGet.mock.calls[0]!;
    expect(path).toContain("filterByStatus=active");
    expect(path).toContain("filterByStatus=suspended");
  });

  it("omits empty search from params", async () => {
    mockGet.mockResolvedValue({ items: [], totalCount: 0, stats: {} });

    renderHook(() =>
      useOrganizationList({ skip: 0, take: 20, search: "" })
    );

    await waitFor(() => expect(mockGet).toHaveBeenCalled());

    const [, options] = mockGet.mock.calls[0]!;
    expect(options.params.search).toBeUndefined();
  });

  it("defaults orderBy to createdAt desc", async () => {
    mockGet.mockResolvedValue({ items: [], totalCount: 0, stats: {} });

    renderHook(() => useOrganizationList({ skip: 0, take: 20 }));

    await waitFor(() => expect(mockGet).toHaveBeenCalled());

    const [, options] = mockGet.mock.calls[0]!;
    expect(options.params.orderBy).toBe("createdAt");
    expect(options.params.orderDirection).toBe("desc");
  });

  it("does not fetch for users without organizations access", async () => {
    authState.user = {
      userId: "hr-1",
      email: "hr@example.com",
      fullName: "HR Admin",
      roles: ["HRAdmin"],
    };

    const { result } = renderHook(() =>
      useOrganizationList({ skip: 0, take: 20 })
    );

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(mockGet).not.toHaveBeenCalled();
  });
});

describe("useOrganizationDetail", () => {
  it("calls client.get with correct detail path", async () => {
    const mockDetail = { id: "abc-123", name: "Org" };
    mockGet.mockResolvedValue(mockDetail);

    const { result } = renderHook(() => useOrganizationDetail("abc-123"));

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(mockGet).toHaveBeenCalledWith(
      "/identity/platform-admin/organizations/abc-123",
      expect.objectContaining({ signal: expect.any(AbortSignal) })
    );
    expect(result.current.data).toEqual(mockDetail);
  });

  it("does not fetch when tenantId is null", async () => {
    const { result } = renderHook(() => useOrganizationDetail(null));

    // Give it a tick
    await new Promise((r) => setTimeout(r, 50));

    expect(mockGet).not.toHaveBeenCalled();
    expect(result.current.isLoading).toBe(false);
  });
});

// ── Mutation hooks ───────────────────────────────────────────────────

describe("useCreateOrganization", () => {
  it("posts to the create endpoint with request body", async () => {
    const mockCreated = { organization: { id: "new-id" }, inviteLink: "http://link" };
    mockPost.mockResolvedValue(mockCreated);

    const { result } = renderHook(() => useCreateOrganization());

    await act(async () => {
      await result.current.mutateAsync({
        name: "Acme Corp",
        firstAdminEmail: "admin@acme.com",
      });
    });

    expect(mockPost).toHaveBeenCalledWith(
      "/identity/platform-admin/organizations",
      { name: "Acme Corp", firstAdminEmail: "admin@acme.com" }
    );
    expect(result.current.data).toEqual(mockCreated);
  });

  it("calls onSuccess callback", async () => {
    const onSuccess = vi.fn();
    mockPost.mockResolvedValue({ organization: { id: "x" } });

    const { result } = renderHook(() => useCreateOrganization({ onSuccess }));

    await act(async () => {
      await result.current.mutateAsync({
        name: "Test",
        firstAdminEmail: "t@t.com",
      });
    });

    expect(onSuccess).toHaveBeenCalledOnce();
  });
});

describe("useUpdateOrganization", () => {
  it("patches the correct tenant endpoint", async () => {
    const mockUpdated = { id: "tenant-1", name: "Updated" };
    mockPatch.mockResolvedValue(mockUpdated);

    const { result } = renderHook(() => useUpdateOrganization("tenant-1"));

    await act(async () => {
      await result.current.mutateAsync({ name: "Updated" });
    });

    expect(mockPatch).toHaveBeenCalledWith(
      "/identity/platform-admin/organizations/tenant-1",
      { name: "Updated" }
    );
  });
});

describe("useSuspendOrganization", () => {
  it("posts to the suspend endpoint", async () => {
    mockPost.mockResolvedValue(true);

    const { result } = renderHook(() => useSuspendOrganization());

    await act(async () => {
      await result.current.mutateAsync("tenant-1");
    });

    expect(mockPost).toHaveBeenCalledWith(
      "/identity/platform-admin/organizations/tenant-1/suspend"
    );
  });
});

describe("useReactivateOrganization", () => {
  it("posts to the reactivate endpoint", async () => {
    mockPost.mockResolvedValue(true);

    const { result } = renderHook(() => useReactivateOrganization());

    await act(async () => {
      await result.current.mutateAsync("tenant-1");
    });

    expect(mockPost).toHaveBeenCalledWith(
      "/identity/platform-admin/organizations/tenant-1/reactivate"
    );
  });
});

describe("useArchiveOrganization", () => {
  it("posts to the archive endpoint", async () => {
    mockPost.mockResolvedValue(true);

    const { result } = renderHook(() => useArchiveOrganization());

    await act(async () => {
      await result.current.mutateAsync("tenant-1");
    });

    expect(mockPost).toHaveBeenCalledWith(
      "/identity/platform-admin/organizations/tenant-1/archive"
    );
  });
});

describe("useResendFirstAdminInvite", () => {
  it("posts to the resend endpoint", async () => {
    const mockInvite = { status: "pending", email: "a@b.com" };
    mockPost.mockResolvedValue(mockInvite);

    const { result } = renderHook(() => useResendFirstAdminInvite());

    await act(async () => {
      await result.current.mutateAsync("tenant-1");
    });

    expect(mockPost).toHaveBeenCalledWith(
      "/identity/platform-admin/organizations/tenant-1/first-admin-invite/resend"
    );
    expect(result.current.data).toEqual(mockInvite);
  });
});

describe("useRevokeFirstAdminInvite", () => {
  it("posts to the revoke endpoint", async () => {
    mockPost.mockResolvedValue(true);

    const { result } = renderHook(() => useRevokeFirstAdminInvite());

    await act(async () => {
      await result.current.mutateAsync("tenant-1");
    });

    expect(mockPost).toHaveBeenCalledWith(
      "/identity/platform-admin/organizations/tenant-1/first-admin-invite/revoke"
    );
  });
});
