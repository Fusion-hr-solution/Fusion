import { describe, expect, it } from "vitest";
import { anEvent } from "@/test/fixtures";
import { describeEvent } from "./tenant-events";

const AT = "2026-08-01T09:00:00Z";

describe("describeEvent", () => {
  it("reads each recorded event as a sentence, not a stored name", () => {
    const titles = [
      ["TenantProvisioned", "Tenant provisioned"],
      ["InvitationResent", "Invitation resent"],
      ["InvitationRevoked", "Invitation revoked"],
      ["InvitationReplaced", "Invited email replaced"],
      ["InvitationReissued", "Invitation reissued"],
      ["BootstrapCompleted", "Administrator activated"],
    ] as const;

    for (const [eventType, expected] of titles) {
      expect(describeEvent(anEvent(eventType, AT)).title).toBe(expected);
    }
  });

  it("splits a delivery attempt by its outcome", () => {
    // The same stored record is a sent invitation or a bounced one, and
    // "delivery attempted" tells the reader neither.
    expect(describeEvent(anEvent("InvitationDeliveryAttempted", AT)).title).toBe(
      "Invitation sent"
    );
    expect(
      describeEvent(
        anEvent("InvitationDeliveryAttempted", AT, { outcome: "Failed" })
      ).title
    ).toBe("Invitation delivery failed");
  });

  it("marks only the events the platform must answer for as failures", () => {
    expect(
      describeEvent(
        anEvent("InvitationDeliveryAttempted", AT, { outcome: "Failed" })
      ).isFailure
    ).toBe(true);
    expect(
      describeEvent(anEvent("ActivationRejected", AT, { outcome: "Rejected" }))
        .isFailure
    ).toBe(true);

    // A revoked invitation is a deliberate act, not something that went wrong.
    expect(describeEvent(anEvent("InvitationRevoked", AT)).isFailure).toBe(false);
    expect(describeEvent(anEvent("BootstrapCompleted", AT)).isFailure).toBe(false);
  });

  it("reports an unrecognised event without leaking its stored name", () => {
    const described = describeEvent(anEvent("SomeFutureEventType", AT));

    expect(described.title).toBe("Tenant activity");
    expect(described.title).not.toContain("SomeFutureEventType");
  });

  it("gives every event a glyph", () => {
    for (const eventType of [
      "TenantProvisioned",
      "InvitationDeliveryAttempted",
      "BootstrapCompleted",
      "SomeFutureEventType",
    ]) {
      expect(describeEvent(anEvent(eventType, AT)).icon).toBeTruthy();
    }
  });
});
