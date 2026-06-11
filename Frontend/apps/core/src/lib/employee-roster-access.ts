import {
  canAccessCorePeople,
  canAccessCoreTeam,
  canAccessOwnCoreProfile,
  type AuthUser,
} from "@repo/auth";

export function canAccessEmployeeRoster(user: AuthUser | null): boolean {
  return canAccessCorePeople(user);
}

export function isPlatformAdminInTenantContext(
  user: AuthUser | null,
  tenantId: string | null,
  tenantReady: boolean,
): boolean {
  return !!user?.roles.includes("PlatformAdmin") && !!tenantId && tenantReady;
}

export function canSeeEmployeeRosterNavigation(user: AuthUser | null): boolean {
  return canAccessEmployeeRoster(user);
}

export function canAccessEmployeeProfile(user: AuthUser | null): boolean {
  return (
    canAccessEmployeeRoster(user) ||
    canAccessOwnCoreProfile(user) ||
    canAccessCoreTeam(user)
  );
}

export function canAccessSelfEmployeeProfile(user: AuthUser | null): boolean {
  return canAccessOwnCoreProfile(user);
}

export function canSeeSelfEmployeeProfileNavigation(
  user: AuthUser | null
): boolean {
  return canAccessSelfEmployeeProfile(user);
}

export function canAccessTeamWorkspace(user: AuthUser | null): boolean {
  return canAccessCoreTeam(user);
}

export function canSeeTeamWorkspaceNavigation(user: AuthUser | null): boolean {
  return canAccessTeamWorkspace(user);
}
