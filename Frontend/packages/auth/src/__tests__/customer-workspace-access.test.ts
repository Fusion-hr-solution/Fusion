import { describe, expect, it } from "vitest";
import { resolveCustomerWorkspaceAccessState } from "../customer-workspace-access";
import type { AuthUser } from "../types";

function makeUser(roles: string[]): AuthUser {
  return {
    userId: "user-1",
    tenantId: "tenant-1",
    email: "user@example.com",
    fullName: "Test User",
    roles,
    employeeId: null,
    accessProfiles: [],
    effectivePermissions: [],
  };
}

describe("resolveCustomerWorkspaceAccessState", () => {
  it("waits for the session before deciding", () => {
    expect(
      resolveCustomerWorkspaceAccessState({ isLoading: true, user: null })
    ).toBe("loading");
  });

  it("sends an unauthenticated visitor to sign-in", () => {
    expect(
      resolveCustomerWorkspaceAccessState({ isLoading: false, user: null })
    ).toBe("sign-in-required");
  });

  it("denies a Platform Administrator", () => {
    expect(
      resolveCustomerWorkspaceAccessState({
        isLoading: false,
        user: makeUser(["PlatformAdmin"]),
      })
    ).toBe("forbidden");
  });

  it("denies a Platform Administrator carrying extra role names", () => {
    // Provisioning never grants a Platform Administrator account a customer
    // membership, so this combination is not a legitimate tenant account.
    expect(
      resolveCustomerWorkspaceAccessState({
        isLoading: false,
        user: makeUser(["PlatformAdmin", "HRAdmin"]),
      })
    ).toBe("forbidden");
    expect(
      resolveCustomerWorkspaceAccessState({
        isLoading: false,
        user: makeUser(["PlatformAdmin", "Manager", "Employee"]),
      })
    ).toBe("forbidden");
  });

  it("admits tenant accounts and leaves the rest to permissions", () => {
    for (const roles of [["HRAdmin"], ["Manager"], ["Employee"], []]) {
      expect(
        resolveCustomerWorkspaceAccessState({
          isLoading: false,
          user: makeUser(roles),
        })
      ).toBe("allowed");
    }
  });
});
