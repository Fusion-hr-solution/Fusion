import { describe, expect, it } from "vitest";
import type { TenantOverviewRow } from "../api";
import { exportFileName, toCsv } from "./tenant-export";

const row: TenantOverviewRow = {
  tenantId: "11111111-1111-1111-1111-111111111111",
  name: "Atlas Group",
  administratorActivationStatus: "AwaitingAdministratorActivation",
  initialAdministratorEmail: "admin@atlas.example",
  bootstrapInvitationId: "22222222-2222-2222-2222-222222222222",
  invitationState: "Pending",
  allowedActions: ["resend", "revoke", "replace"],
  lastDeliveryOutcome: "Failed",
  attentionReason: "DeliveryFailed",
  needsAttention: true,
  modules: ["CoreHR", "Performance"],
  createdAt: "2026-03-14T09:30:00Z",
};

describe("toCsv", () => {
  it("exports the facts the list shows, in user-facing language", () => {
    const [header, first] = toCsv([row]).trim().split("\r\n");

    expect(header).toBe(
      '"Tenant","Tenant status","Initial administrator","Invitation status","Delivery outcome","Enabled modules","Created"'
    );
    expect(first).toBe(
      '"Atlas Group","Awaiting administrator activation","admin@atlas.example","Pending","Delivery failed","Core HR; Performance","2026-03-14"'
    );
  });

  it("carries no invitation identifiers or internal state", () => {
    const csv = toCsv([row]);

    expect(csv).not.toContain(row.bootstrapInvitationId!);
    expect(csv).not.toContain(row.tenantId);
    expect(csv).not.toContain("DeliveryFailed");
    expect(csv).not.toContain("resend");
  });

  it("neutralises a tenant name a spreadsheet would run as a formula", () => {
    // Tenant names come from customers, so a leading = is untrusted input.
    const csv = toCsv([{ ...row, name: "=1+1" }]);

    expect(csv).toContain(`"'=1+1"`);
  });

  it("escapes quotes rather than breaking the row", () => {
    expect(toCsv([{ ...row, name: 'The "Big" Co' }])).toContain(
      '"The ""Big"" Co"'
    );
  });

  it("writes a header even with nothing to export", () => {
    expect(toCsv([]).trim().split("\r\n")).toHaveLength(1);
  });

  it("leaves a missing administrator blank rather than inventing one", () => {
    const csv = toCsv([
      { ...row, initialAdministratorEmail: null, invitationState: null, lastDeliveryOutcome: null },
    ]);

    expect(csv).toContain('"Atlas Group","Awaiting administrator activation","","","",');
  });
});

describe("exportFileName", () => {
  it("names the file by the day it was taken", () => {
    expect(exportFileName(new Date(2026, 2, 5))).toBe("fusion-tenants-2026-03-05.csv");
  });
});
