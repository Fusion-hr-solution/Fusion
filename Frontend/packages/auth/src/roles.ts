import type { AuthUser } from "./types";

export const PLATFORM_ADMIN_ROLE = "PlatformAdmin";
export const HR_ADMIN_ROLE = "HRAdmin";

export function hasAnyRole(
  user: AuthUser | null,
  roles: readonly string[]
): boolean {
  if (!user) {
    return false;
  }

  return roles.some((role) => user.roles.includes(role));
}

export function canAccessCoreSetup(user: AuthUser | null): boolean {
  return hasAnyRole(user, [HR_ADMIN_ROLE]) && !hasAnyRole(user, [PLATFORM_ADMIN_ROLE]);
}

export function canSeeCoreSetupNavigation(user: AuthUser | null): boolean {
  return canAccessCoreSetup(user);
}

export function canAccessOrganizations(user: AuthUser | null): boolean {
  return hasAnyRole(user, [PLATFORM_ADMIN_ROLE]);
}

export function canSeeOrganizationsNavigation(user: AuthUser | null): boolean {
  return canAccessOrganizations(user);
}
