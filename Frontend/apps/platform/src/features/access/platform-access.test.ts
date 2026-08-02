import { describe, expect, it } from "vitest";
import type { AuthUser } from "@repo/auth";
import {
  buildPlatformCallbackUrl,
  resolvePlatformAccessState,
} from "./platform-access";

function makeUser(roles: string[]): AuthUser {
  return {
    userId: "user-1",
    tenantId: "",
  tenantMembershipId: "membership-1",
  moduleEntitlements: ["CoreHR", "Performance"],
    email: "user@example.com",
    fullName: "Test User",
    roles,
    employeeId: null,
    accessProfiles: [],
    effectivePermissions: [],
  };
}

describe("resolvePlatformAccessState", () => {
  it("waits until session hydration completes", () => {
    expect(
      resolvePlatformAccessState({
        isLoading: true,
        user: makeUser(["PlatformAdmin"]),
      }),
    ).toBe("loading");
  });

  it("requires sign-in when no account is present", () => {
    expect(
      resolvePlatformAccessState({ isLoading: false, user: null }),
    ).toBe("sign-in-required");
  });

  it("forbids authenticated non-platform accounts", () => {
    expect(
      resolvePlatformAccessState({
        isLoading: false,
        user: makeUser(["HRAdmin"]),
      }),
    ).toBe("forbidden");
  });

  it("allows platform administrators without a tenant context", () => {
    expect(
      resolvePlatformAccessState({
        isLoading: false,
        user: makeUser(["PlatformAdmin"]),
      }),
    ).toBe("allowed");
  });
});

describe("buildPlatformCallbackUrl", () => {
  it("restores the Platform base path for a direct root request", () => {
    expect(buildPlatformCallbackUrl("/", "")).toBe("/platform");
  });

  it("preserves nested Platform paths and their query", () => {
    expect(buildPlatformCallbackUrl("/missing", "from=direct")).toBe(
      "/platform/missing?from=direct"
    );
  });
});
