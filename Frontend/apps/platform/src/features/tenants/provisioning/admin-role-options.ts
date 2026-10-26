/**
 * Roles offered for the initial administrator on the Initial admin step.
 *
 * Frontend-only for now: the provisioning contract accepts the administrator's
 * email, not a role, so the choice is captured in the draft but not yet sent.
 * When the backend gains a role on provisioning, wire it into the mutation.
 */
import type { Say } from "@repo/ds/lib/say";

export interface AdminRoleOption {
  value: string;
  label: string;
  /** The one-line consequence shown under the Role field. */
  hint: string;
  /** The fuller description shown in the Role summary. */
  summary: string;
}

export const DEFAULT_ADMIN_ROLE = "tenant-hr-admin";

/** The roles, worded by `provisioning.adminRoles.<value>`. */
const ADMIN_ROLES = ["tenant-hr-admin", "hr-manager", "read-only"] as const;

/** The roles in one language. */
export function adminRoleOptions(say: Say): AdminRoleOption[] {
  return ADMIN_ROLES.map((value) => ({
    value,
    label: say(`adminRoles.${value}.label`),
    hint: say(`adminRoles.${value}.hint`),
    summary: say(`adminRoles.${value}.summary`),
  }));
}

/** The chosen role, falling back to the default so the summary always resolves. */
export function adminRoleByValue(value: string, say: Say): AdminRoleOption {
  const options = adminRoleOptions(say);
  return options.find((role) => role.value === value) ?? options[0]!;
}
