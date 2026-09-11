import type {
  FieldErrors,
  ProvisioningDraft,
} from "../provisioning-form-state";

/**
 * Everything a provisioning step needs to read and edit the shared draft.
 *
 * The workspace owns the draft, the validation, and the navigation; a step only
 * renders its slice of the decision and reports edits back through these
 * handlers. Steps that need the module catalogue or the regional option lists
 * derive them locally, so this contract stays small enough that any step can be
 * built on its own.
 */
export type ProvisioningStepProps = {
  draft: ProvisioningDraft;
  errors: FieldErrors;
  update: <K extends keyof ProvisioningDraft>(
    key: K,
    value: ProvisioningDraft[K]
  ) => void;
  /** Re-checks one field, for use on blur once the operator has left it. */
  validateField: (field: keyof FieldErrors) => void;
  /** Adds or removes an optional module from the selection. */
  toggleModule: (key: string, selected: boolean) => void;
};
