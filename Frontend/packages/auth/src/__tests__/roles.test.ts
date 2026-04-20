import { describe, expect, it } from "vitest";
import {
  canAccessCoreSetup,
  canAccessOrganizations,
  canSeeCoreSetupNavigation,
  canSeeOrganizationsNavigation,
} from "../roles";
import type { AuthUser } from "../types";

function makeUser(roles: string[]): AuthUser {
  return {
    userId: "user-1",
    email: "user@example.com",
    fullName: "Test User",
    roles,
  };
}

describe("role helpers", () => {
  it("allows tenant HR admins to access setup and setup navigation", () => {
    const user = makeUser(["HRAdmin"]);

    expect(canAccessCoreSetup(user)).toBe(true);
    expect(canSeeCoreSetupNavigation(user)).toBe(true);
    expect(canAccessOrganizations(user)).toBe(false);
    expect(canSeeOrganizationsNavigation(user)).toBe(false);
  });

  it("allows platform admins to access organizations but not setup", () => {
    const user = makeUser(["PlatformAdmin"]);

    expect(canAccessOrganizations(user)).toBe(true);
    expect(canSeeOrganizationsNavigation(user)).toBe(true);
    expect(canAccessCoreSetup(user)).toBe(false);
    expect(canSeeCoreSetupNavigation(user)).toBe(false);
  });

  it("keeps combined-role users in platform admin mode by default", () => {
    const user = makeUser(["PlatformAdmin", "HRAdmin"]);

    expect(canAccessOrganizations(user)).toBe(true);
    expect(canAccessCoreSetup(user)).toBe(false);
    expect(canSeeOrganizationsNavigation(user)).toBe(true);
    expect(canSeeCoreSetupNavigation(user)).toBe(false);
  });
});