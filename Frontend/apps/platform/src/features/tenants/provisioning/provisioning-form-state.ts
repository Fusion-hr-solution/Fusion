import { failureCode } from "../api";

export interface ProvisioningDraft {
  name: string;
  timeZone: string;
  locale: string;
  /**
   * Registry keys of the optional modules chosen. Keys rather than entitlement
   * identifiers, because the grid is built from the shell registry and only
   * modules the service accepts resolve to an identifier at submission.
   */
  selectedModuleKeys: string[];
  administratorEmail: string;
}

export type ProvisioningField = "name" | "timeZone" | "locale" | "administratorEmail";

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

  if (draft.timeZone.trim().length === 0) {
    errors.timeZone = "Select a time zone.";
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
