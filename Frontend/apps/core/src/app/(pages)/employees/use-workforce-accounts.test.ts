// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { createElement, type PropsWithChildren } from "react";

const { mockGet, mockPost } = vi.hoisted(() => ({
  mockGet: vi.fn(),
  mockPost: vi.fn(),
}));

vi.mock("@repo/api", async () => {
  const actual = await vi.importActual<typeof import("@repo/api")>("@repo/api");
  return {
    ...actual,
    createPlatformApiClient: () => ({
      get: mockGet,
      post: mockPost,
    }),
  };
});

vi.mock("@repo/api/query", async () => {
  const actual = await vi.importActual("@repo/api/query");
  return actual;
});

import { ApiQueryProvider, createApiQueryClient } from "@repo/api/query";
import {
  useBulkProvisionWorkforceAccountInvites,
  useResolveWorkforceAccountStatuses,
  useWorkforceAccountSummary,
} from "./use-workforce-accounts";

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
});

describe("useWorkforceAccountSummary", () => {
  it("calls the workforce account summary endpoint", async () => {
    mockGet.mockResolvedValue({
      activeAccountCount: 14,
      inactiveAccountCount: 2,
      pendingInviteCount: 3,
      acceptedInviteCount: 1,
      expiredInviteCount: 1,
      revokedInviteCount: 1,
      trackedEmployeeCount: 22,
      attentionQueueCount: 5,
    });

    renderHook(() => useWorkforceAccountSummary(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(mockGet).toHaveBeenCalledWith(
        "/corehr/employees/workforce-accounts/summary",
        expect.objectContaining({ signal: expect.any(AbortSignal) })
      );
    });
  });
});

describe("useResolveWorkforceAccountStatuses", () => {
  it("calls the workforce account statuses endpoint", async () => {
    mockPost.mockResolvedValue([]);

    const { result } = renderHook(() => useResolveWorkforceAccountStatuses(), {
      wrapper: createWrapper(),
    });

    await result.current([
      {
        employeeId: "emp-1",
        email: "user@example.com",
        firstName: "User",
        lastName: "Example",
      },
    ]);

    expect(mockPost).toHaveBeenCalledWith(
      "/corehr/employees/workforce-accounts/statuses",
      {
        subjects: [
          {
            employeeId: "emp-1",
            email: "user@example.com",
            firstName: "User",
            lastName: "Example",
          },
        ],
      }
    );
  });
});

describe("useBulkProvisionWorkforceAccountInvites", () => {
  it("calls the workforce bulk-provision endpoint", async () => {
    mockPost.mockResolvedValue([]);

    const { result } = renderHook(
      () => useBulkProvisionWorkforceAccountInvites(),
      {
        wrapper: createWrapper(),
      }
    );

    await result.current.mutateAsync({
      items: [
        {
          employeeId: "emp-1",
          email: "user@example.com",
          firstName: "User",
          lastName: "Example",
          accessProfileId: "profile-employee",
        },
      ],
    });

    expect(mockPost).toHaveBeenCalledWith(
      "/corehr/employees/workforce-accounts/bulk-provision",
      {
        items: [
          {
            employeeId: "emp-1",
            email: "user@example.com",
            firstName: "User",
            lastName: "Example",
            accessProfileId: "profile-employee",
          },
        ],
      }
    );
  });
});
