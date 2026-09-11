/**
 * Roles offered for the initial administrator on the Initial admin step.
 *
 * Frontend-only for now: the provisioning contract accepts the administrator's
 * email, not a role, so the choice is captured in the draft but not yet sent.
 * When the backend gains a role on provisioning, wire it into the mutation.
 */

export interface AdminRoleOption {
  value: string;
  label: string;
  /** The one-line consequence shown under the Role field. */
  hint: string;
  /** The fuller description shown in the Role summary. */
  summary: string;
}

export const DEFAULT_ADMIN_ROLE = "tenant-hr-admin";

export const ADMIN_ROLE_OPTIONS: AdminRoleOption[] = [
  {
    value: "tenant-hr-admin",
    label: "Tenant HR Administrator",
    hint: "This role has full administrative access within the tenant.",
    summary:
      "Full administrative access to manage settings, users, products and more within the tenant.",
  },
  {
    value: "hr-manager",
    label: "HR Manager",
    hint: "Manages people and HR records, without tenant configuration.",
    summary:
      "Manages employees, organization structure and HR records, without access to tenant-wide settings.",
  },
  {
    value: "read-only",
    label: "Read-only Auditor",
    hint: "Can view records across the tenant but cannot make changes.",
    summary:
      "Read-only visibility across the tenant for review and audit, with no ability to make changes.",
  },
];

/** The chosen role, falling back to the default so the summary always resolves. */
export function adminRoleByValue(value: string): AdminRoleOption {
  return (
    ADMIN_ROLE_OPTIONS.find((role) => role.value === value) ??
    ADMIN_ROLE_OPTIONS[0]!
  );
}
