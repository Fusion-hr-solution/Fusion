import { describe, expect, it } from "vitest";
import {
  canStartEmployeeAccess,
  getAccessDisplayState,
  getBulkSelectionSummary,
  getInvitationEligibility,
  matchesEmployeeAccessFilter,
  parseEmployeeAccessFilter,
} from "./employee-access";
import type { WorkforceAccountStatusDto } from "./employee-roster.types";

function buildAccount(
  overrides: Partial<WorkforceAccountStatusDto>
): WorkforceAccountStatusDto {
  return {
    employeeId: "employee-1",
    email: "employee@example.com",
    fullName: "Employee One",
    role: "Employee",
    accessProfiles: [],
    provisioningState: "Unprovisioned",
    userId: null,
    isActive: null,
    lastLoginAt: null,
    inviteId: null,
    inviteCreatedAt: null,
    inviteExpiresAt: null,
    inviteLink: null,
    deliveryStatus: null,
    deliveryMessage: null,
    deliveryRecordedAt: null,
    conflict: null,
    ...overrides,
  };
}

describe("employee access helpers", () => {
  it("parses known access filters and rejects unknown values", () => {
    expect(parseEmployeeAccessFilter("NeedsAccess")).toBe("NeedsAccess");
    expect(parseEmployeeAccessFilter("InviteExpired")).toBe("InviteExpired");
    expect(parseEmployeeAccessFilter("Provisioned")).toBeUndefined();
  });

  it("allows access activation only for records without usable access", () => {
    expect(canStartEmployeeAccess(null)).toBe(true);
    expect(
      canStartEmployeeAccess(
        buildAccount({ provisioningState: "InviteExpired" })
      )
    ).toBe(true);
    expect(
      canStartEmployeeAccess(
        buildAccount({ provisioningState: "InvitePending" })
      )
    ).toBe(false);
    expect(
      canStartEmployeeAccess(buildAccount({ provisioningState: "Active" }))
    ).toBe(false);
  });

  it("maps access states and invitation eligibility for pending invites", () => {
    const account = buildAccount({
      provisioningState: "InvitePending",
      inviteLink: "https://example.test/invite",
      deliveryStatus: "Suppressed",
    });

    expect(getAccessDisplayState(account)).toBe("Invite pending");

    const eligibility = getInvitationEligibility(account);
    expect(eligibility.canInvite).toBe(false);
    expect(eligibility.canResend).toBe(true);
    expect(eligibility.canCopyInviteLink).toBe(true);
    expect(eligibility.notIncludedReason).toBe("Already invited");
  });

  it("builds bulk selection summary for mixed account states", () => {
    const summary = getBulkSelectionSummary([
      { directReportCount: 2, workforceAccount: null },
      {
        directReportCount: 0,
        workforceAccount: buildAccount({ provisioningState: "InvitePending" }),
      },
      {
        directReportCount: 0,
        workforceAccount: buildAccount({ provisioningState: "Active" }),
      },
    ]);

    expect(summary.selectedCount).toBe(3);
    expect(summary.readyToInviteCount).toBe(1);
    expect(summary.managerSuggestionCount).toBe(1);
    expect(summary.pendingCount).toBe(1);
    expect(summary.activeCount).toBe(1);
  });

  it("matches invite lifecycle filters", () => {
    expect(
      matchesEmployeeAccessFilter(
        buildAccount({ provisioningState: "InviteExpired" }),
        "InviteExpired"
      )
    ).toBe(true);

    expect(
      matchesEmployeeAccessFilter(
        buildAccount({ provisioningState: "InviteRevoked" }),
        "InviteRevoked"
      )
    ).toBe(true);
  });
});
