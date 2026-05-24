import { describe, expect, it } from "vitest";
import type { AuthUser } from "@repo/auth";
import { resolveInviteAcceptanceDestination } from "./invite-acceptance-routing";

function createAuthUser(overrides: Partial<AuthUser>): AuthUser {
  return {
    userId: "user-1",
    tenantId: "tenant-1",
    email: "test@example.com",
    fullName: "Test User",
    roles: [],
    employeeId: null,
    accessProfiles: [],
    effectivePermissions: [],
    ...overrides,
  };
}

describe("resolveInviteAcceptanceDestination", () => {
  it("sends employees to My Profile", () => {
    expect(
      resolveInviteAcceptanceDestination(createAuthUser({
        roles: ["Employee"],
        employeeId: "emp-1",
      }))
    ).toBe("/profile");
  });

  it("sends managers to My Profile", () => {
    expect(
      resolveInviteAcceptanceDestination(createAuthUser({
        roles: ["Manager"],
        employeeId: "emp-1",
      }))
    ).toBe("/profile");
  });

  it("sends hr admins to setup summary", () => {
    expect(
      resolveInviteAcceptanceDestination(createAuthUser({
        roles: ["HRAdmin"],
        employeeId: null,
      }))
    ).toBe("/setup");
  });

  it("keeps platform admins on the admin workspace root", () => {
    expect(
      resolveInviteAcceptanceDestination(createAuthUser({
        roles: ["PlatformAdmin"],
        employeeId: null,
      }))
    ).toBe("/organizations");
  });
});
