import { describe, expect, it } from "vitest";
import { aTenant, anEvent } from "@/test/fixtures";
import {
  activationCompletedAt,
  coreSetupState,
  hasEstablishedAccess,
  initialAdministratorEmail,
  provisioningOrigin,
  recentEvents,
} from "./tenant-record-facts";

describe("provisioningOrigin", () => {
  it("reports who provisioned the tenant and when", () => {
    const origin = provisioningOrigin([
      anEvent("InvitationDeliveryAttempted", "2026-08-01T09:01:00Z"),
      anEvent("TenantProvisioned", "2026-08-01T09:00:00Z", {
        actorName: "Nadia Haddad",
      }),
    ]);

    expect(origin).toEqual({
      actorName: "Nadia Haddad",
      occurredAt: "2026-08-01T09:00:00Z",
    });
  });

  it("returns nothing when history no longer reaches the provisioning event", () => {
    expect(provisioningOrigin([anEvent("InvitationResent", "2026-08-02T09:00:00Z")]))
      .toBeNull();
  });
});

describe("activationCompletedAt", () => {
  it("reads the moment from the event that did it", () => {
    expect(
      activationCompletedAt([anEvent("BootstrapCompleted", "2026-08-03T11:00:00Z")])
    ).toBe("2026-08-03T11:00:00Z");
  });

  it("is absent for a tenant that has not activated", () => {
    expect(activationCompletedAt([anEvent("InvitationResent", "x")])).toBeNull();
  });
});

describe("hasEstablishedAccess", () => {
  it("follows the tenant status, which activation is the only thing that moves", () => {
    expect(hasEstablishedAccess(aTenant())).toBe(false);
    expect(
      hasEstablishedAccess(aTenant({ administratorActivationStatus: "Active" }))
    ).toBe(true);
  });
});

describe("coreSetupState", () => {
  it("states setup has not started while nobody can have entered Core", () => {
    expect(coreSetupState(aTenant())).toBe("Setup not started");
  });

  it("claims nothing once an administrator could have started setup", () => {
    // Platform does not observe Core's setup state, and inventing one would
    // report a lifecycle Core never agreed to.
    expect(
      coreSetupState(aTenant({ administratorActivationStatus: "Active" }))
    ).toBeNull();
  });
});

describe("initialAdministratorEmail", () => {
  it("is absent when no invitation is on record", () => {
    expect(initialAdministratorEmail(aTenant())).toBeNull();
  });
});

describe("recentEvents", () => {
  it("returns the newest first regardless of the order it was given", () => {
    const entries = recentEvents(
      [
        anEvent("TenantProvisioned", "2026-08-01T09:00:00Z"),
        anEvent("BootstrapCompleted", "2026-08-03T09:00:00Z"),
        anEvent("InvitationResent", "2026-08-02T09:00:00Z"),
      ],
      2
    );

    expect(entries.map((entry) => entry.eventType)).toEqual([
      "BootstrapCompleted",
      "InvitationResent",
    ]);
  });

  it("does not mutate the record it was given", () => {
    const history = [
      anEvent("TenantProvisioned", "2026-08-01T09:00:00Z"),
      anEvent("BootstrapCompleted", "2026-08-03T09:00:00Z"),
    ];
    recentEvents(history, 2);

    expect(history[0]!.eventType).toBe("TenantProvisioned");
  });
});
