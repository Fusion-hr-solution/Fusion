import { failureCode } from "../api";

export interface ProvisioningDraft {
  name: string;
  /**
   * Organization details captured on the first step. Frontend-only for now —
   * the contract accepts the tenant name, so the slug, legal entity, reference
   * code, and description are held in the draft but not sent. The slug is still
   * validated here because the step presents it as a required identifier.
   */
  tenantSlug: string;
  legalEntityName: string;
  internalReferenceCode: string;
  shortDescription: string;
  timeZone: string;
  locale: string;
  /**
   * Presentation defaults captured on the Region & products step. Frontend-only
   * for now — the provisioning contract does not yet accept them, so they are
   * held in the draft but not sent. See regional-presentation-options.
   */
  country: string;
  dateFormat: string;
  /**
   * Initial-administrator details captured on the Initial admin step. Frontend
   * only for now — the contract accepts the administrator's email, so name,
   * role, and invitation timing are held in the draft but not sent.
   */
  firstName: string;
  lastName: string;
  adminRole: string;
  sendInvitation: boolean;
  /**
   * Registry keys of the optional modules chosen. Keys rather than entitlement
   * identifiers, because the grid is built from the shell registry and only
   * modules the service accepts resolve to an identifier at submission.
   */
  selectedModuleKeys: string[];
  administratorEmail: string;
}

export type ProvisioningField =
  | "name"
  | "tenantSlug"
  | "timeZone"
  | "locale"
  | "administratorEmail"
  | "firstName"
  | "lastName";

/** Lowercase, numbers, and single hyphens between them — a URL-safe slug. */
const TENANT_SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export type FieldErrors = Partial<Record<ProvisioningField, string>>;

/**
 * Checked before the request is sent so an ordinary mistake is answered
 * immediately, at the field that caused it, rather than after a round trip.
 * The service revalidates everything regardless.
 */
export function validateDraft(draft: ProvisioningDraft): FieldErrors {
  const errors: FieldErrors = {};
  const name = draft.name.trim();

  if (name.length === 0) {
    errors.name = "Enter a tenant name.";
  } else if (name.length < 2 || name.length > 100) {
    errors.name = "Tenant name must be 2 to 100 characters.";
  }

  const slug = draft.tenantSlug.trim();
  if (slug.length === 0) {
    errors.tenantSlug = "Enter a tenant slug.";
  } else if (!TENANT_SLUG_PATTERN.test(slug)) {
    errors.tenantSlug = "Use lowercase letters, numbers, and hyphens only.";
  }

  if (draft.timeZone.trim().length === 0) {
    errors.timeZone = "Select a time zone.";
  }

  const firstName = draft.firstName.trim();
  if (firstName.length === 0) {
    errors.firstName = "Enter the administrator's first name.";
  } else if (firstName.length > 100) {
    errors.firstName = "First name must be 100 characters or fewer.";
  }

  const lastName = draft.lastName.trim();
  if (lastName.length === 0) {
    errors.lastName = "Enter the administrator's last name.";
  } else if (lastName.length > 100) {
    errors.lastName = "Last name must be 100 characters or fewer.";
  }

  const email = draft.administratorEmail.trim();
  if (email.length === 0) {
    errors.administratorEmail = "Enter the initial administrator's email.";
  } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    errors.administratorEmail = "Enter a valid email address.";
  }

  return errors;
}

const CODE_TO_FIELD: Record<string, ProvisioningField> = {
  "provisioning.name_invalid": "name",
  "provisioning.duplicate_name": "name",
  "provisioning.time_zone_required": "timeZone",
  "provisioning.time_zone_unsupported": "timeZone",
  "provisioning.locale_unsupported": "locale",
  "provisioning.administrator_email_invalid": "administratorEmail",
};

/**
 * Puts a refused request back on the control that can resolve it. A failure with
 * no field — a conflicting idempotency key, an unreachable service — returns
 * null and is reported at the point of submission instead.
 */
export function fieldForFailure(error: unknown): ProvisioningField | null {
  const code = failureCode(error);
  return code ? (CODE_TO_FIELD[code] ?? null) : null;
}
