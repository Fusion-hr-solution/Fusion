import type { AuthUser } from "@repo/auth";

export function resolveInviteAcceptanceDestination(
  user: Pick<AuthUser, "roles" | "employeeId">
): string {
  if (
    user.roles.includes("HRAdmin") ||
    user.roles.includes("PlatformAdmin")
  ) {
    return "/";
  }

  if (
    user.employeeId &&
    (user.roles.includes("Employee") || user.roles.includes("Manager"))
  ) {
    return "/profile";
  }

  return "/";
}
