import type {
  AttentionReason,
  DeliveryOutcomeValue,
  InvitationStateValue,
  TenantActivationStatus,
} from "../api";
import { tenantWords, type TenantWords } from "../language";

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

export function activationSummary(
  row: ActivationInput,
  words: TenantWords = tenantWords()
): ActivationSummary {
  const { say } = words;
  const status = words.status(row.administratorActivationStatus);
  const isException = row.attentionReason !== "None";

  if (row.administratorActivationStatus === "Active") {
    // The tenant is in; how its invitation was delivered is now history.
    return { status, detail: say("activation.activated"), isException: false };
  }

  if (!row.invitationState) {
    return { status, detail: say("activation.noInvitation"), isException };
  }

  const invitation = words.invitation(row.invitationState);

  switch (row.invitationState) {
    case "Pending":
      // Validity first, delivery second — never delivery instead of validity.
      return {
        status,
        detail: `${invitation} · ${
          row.lastDeliveryOutcome
            ? words.delivery(row.lastDeliveryOutcome)
            : say("activation.notSent")
        }`,
        isException,
      };

    case "Expired":
    case "Revoked":
      // Both leave the tenant with no live route in, and both are fixed the
      // same way, so the row says what has to happen next.
      return { status, detail: `${invitation} · ${say("activation.reissueRequired")}`, isException };

    default:
      return { status, detail: invitation, isException };
  }
}
