import {
  canAccessCoreAccess,
  canAccessCoreOverview,
  canAccessCorePeople,
  canAccessCoreSetup,
  canAccessCoreSettings,
  canAccessCoreTeam,
  canAccessOwnCoreProfile,
  canManageCoreAccessProfiles,
  type AuthUser,
} from "@repo/auth";

export function resolveInviteAcceptanceDestination(
  user: AuthUser
): string {
  if (canAccessCoreOverview(user)) {
    return "/";
  }

  if (canAccessCoreAccess(user)) {
    return "/access";
  }

  if (canManageCoreAccessProfiles(user)) {
    return "/settings?tab=access-permissions";
  }

  if (canAccessCoreSetup(user)) {
    return "/setup";
  }

  if (canAccessCoreSettings(user)) {
    return "/settings";
  }

  if (canAccessCorePeople(user)) {
    return "/employees";
  }

  if (canAccessCoreTeam(user)) {
    return "/team";
  }

  if (canAccessOwnCoreProfile(user)) {
    return "/profile";
  }

  return "/";
}
