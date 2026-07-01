import { describe, expect, it } from "vitest";
import {
  classifyActionCohort,
  getAccessDisplayState,
  getInvitationEligibility,
  isProvisionableInBulk,
  matchesEmployeeAccessFilter,
  parseEmployeeAccessFilter,
} from "./employee-access";
import type { WorkforceAccountStatusDto } from "@/app/(pages)/employees/employee-roster.types";

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
    expect(parseEmployeeAccessFilter("NotInvited")).toBe("NotInvited");
    expect(parseEmployeeAccessFilter("NeedsReview")).toBe("NeedsReview");
    expect(parseEmployeeAccessFilter("Provisioned")).toBeUndefined();
  });

  it("classifies invite lifecycle states consistently with backend access groups", () => {
    expect(getAccessDisplayState(null)).toBe("Not invited");
    expect(
      getAccessDisplayState(buildAccount({ provisioningState: "InvitePending" }))
    ).toBe("Invite pending");
    expect(getAccessDisplayState(buildAccount({ provisioningState: "Active" }))).toBe(
      "Active account"
    );
    expect(
      getAccessDisplayState(buildAccount({ provisioningState: "InviteAccepted" }))
    ).toBe("Needs review");
  });

  it("matches roster access filters by canonical access group", () => {
    expect(matchesEmployeeAccessFilter(null, undefined)).toBe(true);
    expect(matchesEmployeeAccessFilter(null, "NotInvited")).toBe(true);
    expect(
      matchesEmployeeAccessFilter(
        buildAccount({ provisioningState: "InviteAccepted" }),
        "NeedsReview"
      )
    ).toBe(true);
    expect(
      matchesEmployeeAccessFilter(
        buildAccount({ provisioningState: "InviteAccepted" }),
        "AccountActive"
      )
    ).toBe(false);
  });

  it("allows bulk provisioning only for new or refreshable invitations", () => {
    const expired = buildAccount({ provisioningState: "InviteExpired" });
    const active = buildAccount({ provisioningState: "Active" });

    expect(isProvisionableInBulk(classifyActionCohort(null))).toBe(true);
    expect(isProvisionableInBulk(classifyActionCohort(expired))).toBe(true);
    expect(isProvisionableInBulk(classifyActionCohort(active))).toBe(false);
  });

  it("builds action eligibility from account state and conflicts", () => {
    const conflict = buildAccount({
      provisioningState: "Conflict",
      conflict: {
        kind: "EmailAlreadyRegistered",
        message: "Email already belongs to another account.",
        blocking: true,
        suggestedAction: null,
      },
    });

    expect(getInvitationEligibility(null).canInvite).toBe(true);
    expect(getInvitationEligibility(conflict)).toMatchObject({
      canInvite: false,
      canResend: false,
      hasConflict: true,
      notIncludedReason: "Email already belongs to another account.",
    });
  });
});
