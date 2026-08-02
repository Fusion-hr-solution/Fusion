import { describe, expect, it } from "vitest";
import type { TenantActivityEntry } from "../api";
import {
  activityActor,
  activityNarrative,
  activityTimestamp,
} from "./tenant-activity-language";

const entry = (over: Partial<TenantActivityEntry> = {}): TenantActivityEntry => ({
  eventType: "TenantProvisioned",
  tenantId: "11111111-1111-1111-1111-111111111111",
  tenantName: "Northwind Tunisia",
  occurredAt: "2026-08-01T10:42:00Z",
  outcome: "Succeeded",
  actorName: "System Admin",
  ...over,
});

describe("activityNarrative", () => {
  it("reads the same delivery record as sent or as failed", () => {
    const sent = activityNarrative(
      entry({ eventType: "InvitationDeliveryAttempted", outcome: "Succeeded" })
    );
    const failed = activityNarrative(
      entry({ eventType: "InvitationDeliveryAttempted", outcome: "Failed" })
    );

    expect(sent.title).toBe("Invitation sent");
    expect(sent.isFailure).toBe(false);

    expect(failed.title).toBe("Invitation delivery failed");
    expect(failed.isFailure).toBe(true);
  });

  it("states meaning in words, never by colour alone", () => {
    // Every failure carries a title that says so, so the red tint is
    // reinforcement rather than the only signal.
    for (const eventType of ["InvitationDeliveryAttempted", "ActivationRejected"]) {
      const narrative = activityNarrative(entry({ eventType, outcome: "Failed" }));
      expect(narrative.isFailure).toBe(true);
      expect(narrative.title).toMatch(/failed|rejected/i);
    }
  });

  it("keeps a calm reading for ordinary events", () => {
    for (const eventType of [
      "TenantProvisioned",
      "InvitationResent",
      "InvitationRevoked",
      "InvitationReplaced",
      "InvitationReissued",
      "BootstrapCompleted",
    ]) {
      expect(activityNarrative(entry({ eventType })).isFailure).toBe(false);
    }
  });

  it("uses no domain vocabulary in the words it shows", () => {
    const types = [
      "TenantProvisioned",
      "InvitationDeliveryAttempted",
      "InvitationResent",
      "InvitationRevoked",
      "InvitationReplaced",
      "InvitationReissued",
      "BootstrapCompleted",
      "ActivationRejected",
    ];

    for (const eventType of types) {
      const { title, before, after } = activityNarrative(entry({ eventType }));
      const text = `${title} ${before} ${after}`;
      expect(text).not.toMatch(/Bootstrap|Superseded|correlation|payload|Attempted/i);
    }
  });

  it("still reports an event this build has no wording for", () => {
    const narrative = activityNarrative(
      entry({ eventType: "SomethingAddedLater", outcome: "Failed" })
    );

    // It must not disappear from the history just because it is unrecognised.
    expect(narrative.title).toBe("Tenant activity");
    expect(narrative.isFailure).toBe(true);
  });

  it("splits the sentence so the tenant name can carry the link", () => {
    const narrative = activityNarrative(entry({ eventType: "BootstrapCompleted" }));

    // The name is never baked into the string; it is rendered between the two
    // halves as a link.
    expect(narrative.before + narrative.after).not.toContain("Northwind");
    expect(narrative.after).toBe(" completed administrator activation.");
  });
});

describe("activityTimestamp", () => {
  const now = new Date(2026, 7, 1, 15, 0);

  it("says today and yesterday while they are unambiguous", () => {
    expect(activityTimestamp(new Date(2026, 7, 1, 10, 42).toISOString(), now)).toMatch(
      /^Today at /
    );
    expect(activityTimestamp(new Date(2026, 6, 31, 16, 15).toISOString(), now)).toMatch(
      /^Yesterday at /
    );
  });

  it("counts calendar days, not elapsed hours", () => {
    // 23:59 yesterday is yesterday, even though it is minutes away.
    expect(
      activityTimestamp(new Date(2026, 6, 31, 23, 59).toISOString(), new Date(2026, 7, 1, 0, 1))
    ).toMatch(/^Yesterday at /);
  });

  it("falls back to a date once relative wording stops helping", () => {
    const older = activityTimestamp(new Date(2026, 6, 20, 9, 0).toISOString(), now);
    expect(older).not.toMatch(/Today|Yesterday/);
  });

  it("shows the year only when it is not the current one", () => {
    expect(activityTimestamp(new Date(2025, 1, 3).toISOString(), now)).toMatch(/2025/);
    expect(activityTimestamp(new Date(2026, 1, 3).toISOString(), now)).not.toMatch(/2026/);
  });
});

describe("activityActor", () => {
  it("names the platform rather than leaving a gap", () => {
    expect(activityActor(entry({ actorName: null }))).toBe("Fusion Platform");
    expect(activityActor(entry({ actorName: "   " }))).toBe("Fusion Platform");
  });

  it("uses the person when there was one", () => {
    expect(activityActor(entry({ actorName: "System Admin" }))).toBe("System Admin");
  });
});
