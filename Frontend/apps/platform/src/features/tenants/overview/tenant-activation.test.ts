import { describe, expect, it } from "vitest";
import { activationSummary, type ActivationInput } from "./tenant-activation";

const awaiting: ActivationInput = {
  administratorActivationStatus: "AwaitingAdministratorActivation",
  invitationState: "Pending",
  lastDeliveryOutcome: "Sent",
  attentionReason: "None",
};

describe("activationSummary", () => {
  it("states the tenant status and the invitation condition separately", () => {
    const summary = activationSummary(awaiting);

    expect(summary.status).toBe("Awaiting administrator activation");
    expect(summary.detail).toBe("Pending · Sent");
    expect(summary.isException).toBe(false);
  });

  it("keeps the invitation valid when its message failed to arrive", () => {
    const summary = activationSummary({
      ...awaiting,
      lastDeliveryOutcome: "Failed",
      attentionReason: "DeliveryFailed",
    });

    // Both facts survive. Replacing the state with the delivery failure would
    // leave the reader unable to tell whether the invitation had also lapsed.
    expect(summary.detail).toBe("Pending · Delivery failed");
    expect(summary.isException).toBe(true);
  });

  it("says what has to happen next for a lapsed invitation", () => {
    expect(
      activationSummary({
        ...awaiting,
        invitationState: "Expired",
        lastDeliveryOutcome: "Sent",
        attentionReason: "InvitationExpired",
      }).detail
    ).toBe("Expired · Reissue required");

    expect(
      activationSummary({
        ...awaiting,
        invitationState: "Revoked",
        attentionReason: "InvitationRevoked",
      }).detail
    ).toBe("Revoked · Reissue required");
  });

  it("drops delivery history once the administrator is in", () => {
    const summary = activationSummary({
      administratorActivationStatus: "Active",
      invitationState: "Accepted",
      lastDeliveryOutcome: "Failed",
      attentionReason: "None",
    });

    expect(summary.status).toBe("Active");
    expect(summary.detail).toBe("Administrator activated");
    expect(summary.isException).toBe(false);
  });

  it("prefers the user-facing word Replaced over the domain term", () => {
    const summary = activationSummary({
      ...awaiting,
      invitationState: "Superseded",
      attentionReason: "None",
    });

    expect(summary.detail).toBe("Replaced");
    expect(summary.detail).not.toContain("Superseded");
  });

  it("says a pending invitation has not been sent rather than inventing an outcome", () => {
    expect(
      activationSummary({ ...awaiting, lastDeliveryOutcome: null }).detail
    ).toBe("Pending · Not sent");
  });

  it("gives every row the same two-line shape", () => {
    const rows: ActivationInput[] = [
      awaiting,
      { ...awaiting, invitationState: "Expired", attentionReason: "InvitationExpired" },
      { ...awaiting, invitationState: null, lastDeliveryOutcome: null },
      {
        administratorActivationStatus: "Active",
        invitationState: "Accepted",
        lastDeliveryOutcome: "Sent",
        attentionReason: "None",
      },
    ];

    // Row height has to stay constant as states change, so no case may return
    // an empty second line.
    for (const row of rows) {
      const summary = activationSummary(row);
      expect(summary.status.length).toBeGreaterThan(0);
      expect(summary.detail.length).toBeGreaterThan(0);
    }
  });
});
