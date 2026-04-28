import { canAccessCorePeople, type AuthUser } from "@repo/auth";

export function canAccessEmployeeRoster(user: AuthUser | null): boolean {
  return canAccessCorePeople(user);
}

export function canSeeEmployeeRosterNavigation(user: AuthUser | null): boolean {
  return canAccessEmployeeRoster(user);
}
