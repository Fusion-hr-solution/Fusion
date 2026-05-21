import {
  EMPLOYEE_ROLE,
  HR_ADMIN_ROLE,
  MANAGER_ROLE,
  PLATFORM_ADMIN_ROLE,
  type AuthUser,
} from "@repo/auth";

export function resolveInviteAcceptanceDestination(
  user: Pick<AuthUser, "roles" | "employeeId">
): string {
  if (
    user.roles.includes(HR_ADMIN_ROLE) ||
    user.roles.includes(PLATFORM_ADMIN_ROLE)
  ) {
    return "/";
  }

  if (
    user.employeeId &&
    (user.roles.includes(EMPLOYEE_ROLE) || user.roles.includes(MANAGER_ROLE))
  ) {
    return "/profile";
  }

  return "/";
}
