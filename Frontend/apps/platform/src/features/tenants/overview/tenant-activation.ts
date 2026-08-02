import type {
  AttentionReason,
  DeliveryOutcomeValue,
  InvitationStateValue,
  TenantActivationStatus,
} from "../api";
import { DELIVERY_LABEL, INVITATION_LABEL, TENANT_STATUS_LABEL } from "../language";

/**
 * What a row says about activation.
 *
 * Three facts stay separate on purpose, because collapsing them loses real
 * information: the tenant's lifecycle status, whether the invitation is still
 * valid, and whether its message arrived. An expired invitation that was
 * delivered perfectly and a valid invitation that bounced are different
 * problems with different fixes.
 *
 * Every row resolves to the same two-line shape so the column has one rhythm,
 * rather than exceptional rows growing a line the routine ones lack.
 */
interface ActivationSummary {
  /** The locked tenant status. Always present. */
  status: string;
  /** The invitation condition beneath it. Always present. */
  detail: string;
  /** True when the platform, not the recipient, is the one holding this up. */
  isException: boolean;
}

export interface ActivationInput {
  administratorActivationStatus: TenantActivationStatus;
  invitationState: InvitationStateValue | null;
  lastDeliveryOutcome: DeliveryOutcomeValue | null;
  attentionReason: AttentionReason;
}

export function activationSummary(row: ActivationInput): ActivationSummary {
  const status = TENANT_STATUS_LABEL[row.administratorActivationStatus];
  const isException = row.attentionReason !== "None";

  if (row.administratorActivationStatus === "Active") {
    // The tenant is in; how its invitation was delivered is now history.
    return { status, detail: "Administrator activated", isException: false };
  }

  if (!row.invitationState) {
    return { status, detail: "No invitation recorded", isException };
  }

  const invitation = INVITATION_LABEL[row.invitationState];

  switch (row.invitationState) {
    case "Pending":
      // Validity first, delivery second — never delivery instead of validity.
      return {
        status,
        detail: `${invitation} · ${
          row.lastDeliveryOutcome
            ? DELIVERY_LABEL[row.lastDeliveryOutcome]
            : "Not sent"
        }`,
        isException,
      };

    case "Expired":
    case "Revoked":
      // Both leave the tenant with no live route in, and both are fixed the
      // same way, so the row says what has to happen next.
      return { status, detail: `${invitation} · Reissue required`, isException };

    default:
      return { status, detail: invitation, isException };
  }
}
