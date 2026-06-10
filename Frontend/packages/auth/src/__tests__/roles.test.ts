import { describe, expect, it } from "vitest";
import {
  canAccessCorePeople,
  canAccessCoreSettings,
  canAccessCoreSetup,
  canAccessCoreTeam,
  canAccessOwnCoreProfile,
  canAccessOrganizations,
  canSeeCorePeopleNavigation,
  canSeeCoreSettingsNavigation,
  canSeeCoreSetupNavigation,
  canSeeCoreTeamNavigation,
  canSeeOwnCoreProfileNavigation,
  canSeeOrganizationsNavigation,
} from "../roles";
import type { AuthUser } from "../types";

function makeUser(roles: string[], employeeId: string | null = null): AuthUser {
  return {
    userId: "user-1",
    employeeId,
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

  it("allows linked managers to access self and team workspaces", () => {
    const user = makeUser(["Manager"], "employee-1");

    expect(canAccessOwnCoreProfile(user)).toBe(true);
    expect(canSeeOwnCoreProfileNavigation(user)).toBe(true);
    expect(canAccessCoreTeam(user)).toBe(true);
    expect(canSeeCoreTeamNavigation(user)).toBe(true);
    expect(canAccessCorePeople(user)).toBe(false);
  });

  it("allows linked employees to access self workspace but not team workspace", () => {
    const user = makeUser(["Employee"], "employee-1");

    expect(canAccessOwnCoreProfile(user)).toBe(true);
    expect(canSeeOwnCoreProfileNavigation(user)).toBe(true);
    expect(canAccessCoreTeam(user)).toBe(false);
    expect(canSeeCoreTeamNavigation(user)).toBe(false);
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
