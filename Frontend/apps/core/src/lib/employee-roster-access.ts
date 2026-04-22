import { canAccessCoreSetup, type AuthUser } from "@repo/auth";

export function canAccessEmployeeRoster(user: AuthUser | null): boolean {
  return canAccessCoreSetup(user);
}

export function canSeeEmployeeRosterNavigation(
  user: AuthUser | null
): boolean {
  return canAccessEmployeeRoster(user);
}