// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderHook } from "@testing-library/react";
import { createElement, type PropsWithChildren } from "react";

const { mockPost } = vi.hoisted(() => ({
  mockPost: vi.fn(),
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
    post: mockPost,
  }),
}));

vi.mock("@repo/api/query", async () => {
  const actual = await vi.importActual("@repo/api/query");
  return actual;
});

vi.mock("@repo/auth", () => ({
  useAuth: () => authState,
}));

vi.mock("@/lib/employee-roster-access", () => ({
  canAccessEmployeeRoster: () => true,
}));

import { ApiQueryProvider, createApiQueryClient } from "@repo/api/query";
import {
  useBulkProvisionWorkforceAccountInvites,
  useResolveWorkforceAccountStatuses,
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
      "/identity/workforce-accounts/statuses",
      {
        employees: [
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
          role: "Employee",
        },
      ],
    });

    expect(mockPost).toHaveBeenCalledWith(
      "/identity/workforce-accounts/invite/bulk",
      {
        items: [
          {
            employeeId: "emp-1",
            email: "user@example.com",
            firstName: "User",
            lastName: "Example",
            role: "Employee",
          },
        ],
      }
    );
  });
});
