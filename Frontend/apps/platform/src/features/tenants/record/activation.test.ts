import { describe, expect, it } from "vitest";
import { aTenant, anInvitation } from "@/test/fixtures";
import { activationPhase, responsibility } from "./activation";

describe("activationPhase", () => {
  it("is waiting when a valid invitation was delivered", () => {
    expect(activationPhase(aTenant({ bootstrapInvitation: anInvitation() }))).toBe(
      "pending-sent"
    );
  });

  it("separates a bounced message from an invalid invitation", () => {
    // The invitation is still Pending — only its delivery failed — so this must
    // not collapse into the blocked state, which offers a different recovery.
    const tenant = aTenant({
      bootstrapInvitation: anInvitation({
        lastDelivery: {
          outcome: "Failed",
          attemptedAt: "2026-08-01T09:01:00Z",
          failureCode: "mailbox_unavailable",
        },
      }),
    });

    expect(activationPhase(tenant)).toBe("pending-delivery-failed");
  });

  it("is blocked once no usable invitation remains", () => {
    for (const state of ["Expired", "Revoked", "Superseded"] as const) {
      expect(
        activationPhase(aTenant({ bootstrapInvitation: anInvitation({ state }) }))
      ).toBe("blocked");
    }
  });

  it("is blocked when the tenant has no invitation at all", () => {
    expect(activationPhase(aTenant())).toBe("blocked");
  });

  it("is active whenever the tenant is, whatever the invitation says", () => {
    // Activation is what moves the tenant, so the tenant's own status wins.
    const tenant = aTenant({
      administratorActivationStatus: "Active",
      bootstrapInvitation: anInvitation({ state: "Accepted" }),
    });

    expect(activationPhase(tenant)).toBe("active");
  });
});

describe("responsibility", () => {
  it("puts a delivered invitation on its recipient, not on the platform", () => {
    const { label, isPlatform } = responsibility("pending-sent");

    expect(label).toBe("Waiting for the invited administrator");
    expect(isPlatform).toBe(false);
  });

  it("puts a bounced message on the platform", () => {
    const { isPlatform, detail } = responsibility("pending-delivery-failed");

    expect(isPlatform).toBe(true);
    // Validity and delivery stay separate facts even in the sentence.
    expect(detail).toContain("remains valid");
  });

  it("names what happened rather than only its consequence", () => {
    // Expired and revoked call for the same recovery but are not the same
    // event, and the operator's next choice depends on which it was.
    expect(responsibility("blocked", anInvitation({ state: "Expired" })).label).toBe(
      "Invitation expired"
    );
    expect(responsibility("blocked", anInvitation({ state: "Revoked" })).label).toBe(
      "Invitation revoked"
    );
  });

  it("falls back to the platform when a blocked invitation is absent", () => {
    const { label, isPlatform } = responsibility("blocked", null);

    expect(label).toBe("Platform action required");
    expect(isPlatform).toBe(true);
  });

  it("asks nothing of anyone once the administrator has activated", () => {
    const { label, isPlatform } = responsibility("active");

    expect(label).toBe("Administrator access established");
    expect(isPlatform).toBe(false);
  });
});
