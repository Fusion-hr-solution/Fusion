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

describe("useBulkProvisionWorkforceAccountInvites", () => {
  it("calls the corehr bulk-invite endpoint", async () => {
    mockPost.mockResolvedValue({
      items: [],
      totalRequested: 2,
      invitedCount: 1,
      refreshedCount: 0,
      alreadyActiveCount: 1,
      skippedCount: 0,
    });

    const { result } = renderHook(
      () => useBulkProvisionWorkforceAccountInvites(),
      {
        wrapper: createWrapper(),
      }
    );

    await result.current.mutateAsync({
      accessProfileId: "profile-employee",
      search: null,
      access: null,
      profileId: null,
      employeeStatus: null,
      employeeKey: null,
      employeeIds: ["emp-1", "emp-2"],
    });

    expect(mockPost).toHaveBeenCalledWith(
      "/corehr/workforce/access-subjects/bulk-invite",
      {
        accessProfileId: "profile-employee",
        search: null,
        access: null,
        profileId: null,
        employeeStatus: null,
        employeeKey: null,
        employeeIds: ["emp-1", "emp-2"],
      }
    );
  });
});
