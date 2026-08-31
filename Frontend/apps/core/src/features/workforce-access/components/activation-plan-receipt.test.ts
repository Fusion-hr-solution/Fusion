import { describe, expect, it } from "vitest";
import type {
  WorkforceAccessBulkResultItemDto,
  WorkforceAccessCandidateDto,
  WorkforceAccessSubjectSummaryDto,
} from "@repo/api";
import {
  buildOperationalReceipt,
  planCounts,
  planGroupExpansionStep,
  planGroupInitialLimit,
  receiptGroupExpansionStep,
  receiptGroupInitialLimit,
} from "./activation-plan";

function subject(
  employeeId: string,
  accessState: WorkforceAccessSubjectSummaryDto["accessState"],
  workEmail: string | null
): WorkforceAccessSubjectSummaryDto {
  return {
    employeeId,
    stableEmployeeKey: employeeId,
    employeeNumber: employeeId,
    firstName: employeeId,
    lastName: "Person",
    preferredName: null,
    displayName: `${employeeId} Person`,
    workEmail: workEmail ?? "",
    jobTitle: "Analyst",
    orgUnitName: "Operations",
    workLocation: null,
    employmentStatus: "Active",
    isActive: true,
    directReportCount: 0,
    accessState,
    accessStateLabel: accessState,
    accessStateDetail: null,
    accessProfiles: [],
    invitationLabel: "",
    lastActivityLabel: "",
    lastActivityAt: null,
    deliveryState: null,
    reviewReason: null,
    provisioningState: "Unprovisioned",
    userId: null,
  };
}

function missingEmailCandidate(
  employeeId: string
): WorkforceAccessCandidateDto {
  return {
    employeeId,
    stableEmployeeKey: employeeId,
    employeeNumber: employeeId,
    displayName: `${employeeId} Person`,
    fullName: `${employeeId} Person`,
    workEmail: null,
    jobTitle: "Analyst",
    employmentStatus: "Active",
    isActive: true,
    orgUnit: null,
    manager: null,
    directReportCount: 0,
    accountState: "NewAccount",
    accountStateLabel: "New account",
    accountEmail: null,
    recommendedBaseline: "Employee",
    availableActions: [],
    blockedReason: null,
    version: 1,
    isAdministrator: false,
    additionalAccess: [],
    accountRevision: null,
  };
}

describe("buildOperationalReceipt", () => {
  it("preserves committed, pending, and blocked people from the reviewed selection", () => {
    const people = [
      subject("invited", "NotInvited", null),
      subject("pending", "InvitePending", "pending@example.com"),
      subject("blocked", "NotInvited", null),
    ];
    const committed: WorkforceAccessBulkResultItemDto[] = [
      {
        employeeId: "invited",
        displayName: "invited Person",
        outcome: "Invited",
        accountState: "NewAccount",
        message: "Invitation sent.",
      },
    ];

    const receipt = buildOperationalReceipt(
      people,
      [
        {
          ...missingEmailCandidate("invited"),
          workEmail: "invited@example.com",
        },
        missingEmailCandidate("blocked"),
      ],
      committed
    );

    expect(receipt.items).toHaveLength(3);
    expect(receipt.items.map((item) => item.outcome)).toEqual([
      "Invited",
      "AlreadyPending",
      "Blocked",
    ]);
    expect(receipt.items[1]?.message).toContain("No new invitation was sent");
    expect(receipt.items[0]?.email).toBe("invited@example.com");
    expect(receipt.items[2]?.message).toBe(
      "A work email is required before sending an invitation."
    );
  });

  it("keeps consequence totals stable when the rendered plan progressively expands", () => {
    const groups = [
      { key: "new", people: [{}, {}, {}] },
      { key: "pending", people: [{}] },
      { key: "blocked", people: [{}] },
    ] as Parameters<typeof planCounts>[0];

    expect(planCounts(groups)).toEqual({
      invitations: 3,
      links: 0,
      reactivations: 0,
      connections: 0,
      pending: 1,
      alreadyActive: 0,
      attention: 1,
    });
    expect(planCounts(groups)).toEqual(planCounts([...groups]));
  });

  it("progressively discloses needs-review rows as well as routine groups", () => {
    expect(planGroupInitialLimit("attention", 12)).toBe(4);
    expect(planGroupInitialLimit("routine", 12)).toBe(6);
    expect(planGroupInitialLimit("unchanged", 12)).toBe(4);
    expect(planGroupInitialLimit("consequence", 12)).toBe(6);
    expect(planGroupInitialLimit("routine", 378)).toBe(6);
    expect(planGroupExpansionStep("routine")).toBe(20);
    expect(planGroupExpansionStep("attention")).toBe(10);
  });

  it("keeps large receipts bounded until an operator asks for more", () => {
    expect(receiptGroupInitialLimit(true, 100)).toBe(4);
    expect(receiptGroupInitialLimit(false, 100)).toBe(6);
    expect(receiptGroupExpansionStep(true)).toBe(10);
    expect(receiptGroupExpansionStep(false)).toBe(20);
  });
});
