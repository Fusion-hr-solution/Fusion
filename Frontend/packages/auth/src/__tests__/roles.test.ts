import { describe, expect, it } from "vitest";
import {
  canAccessCorePeople,
  canAccessCoreSettings,
  canAccessCoreSetup,
  canAccessOrganizations,
  canSeeCorePeopleNavigation,
  canSeeCoreSettingsNavigation,
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

    expect(canAccessCorePeople(user)).toBe(true);
    expect(canAccessCoreSettings(user)).toBe(true);
    expect(canAccessCoreSetup(user)).toBe(true);
    expect(canSeeCorePeopleNavigation(user)).toBe(true);
    expect(canSeeCoreSettingsNavigation(user)).toBe(true);
    expect(canSeeCoreSetupNavigation(user)).toBe(true);
    expect(canAccessOrganizations(user)).toBe(false);
    expect(canSeeOrganizationsNavigation(user)).toBe(false);
  });

  it("allows platform admins to access organizations but not setup", () => {
    const user = makeUser(["PlatformAdmin"]);

    expect(canAccessOrganizations(user)).toBe(true);
    expect(canSeeOrganizationsNavigation(user)).toBe(true);
    expect(canAccessCorePeople(user)).toBe(false);
    expect(canAccessCoreSettings(user)).toBe(false);
    expect(canAccessCoreSetup(user)).toBe(false);
    expect(canSeeCorePeopleNavigation(user)).toBe(false);
    expect(canSeeCoreSettingsNavigation(user)).toBe(false);
    expect(canSeeCoreSetupNavigation(user)).toBe(false);
  });

  it("keeps combined-role users in platform admin mode by default", () => {
    const user = makeUser(["PlatformAdmin", "HRAdmin"]);

    expect(canAccessOrganizations(user)).toBe(true);
    expect(canAccessCorePeople(user)).toBe(false);
    expect(canAccessCoreSettings(user)).toBe(false);
    expect(canAccessCoreSetup(user)).toBe(false);
    expect(canSeeOrganizationsNavigation(user)).toBe(true);
    expect(canSeeCorePeopleNavigation(user)).toBe(false);
    expect(canSeeCoreSettingsNavigation(user)).toBe(false);
    expect(canSeeCoreSetupNavigation(user)).toBe(false);
  });
});
