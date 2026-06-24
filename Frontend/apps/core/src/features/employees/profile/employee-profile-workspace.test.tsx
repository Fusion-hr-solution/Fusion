// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const {
  mockPush,
  mockInvalidateQueries,
  mockMutateAsync,
  mockSearchParams,
  mockUseWorkforceAccountStatus,
  mockUseAccessProfiles,
  mockUseSetUserAccessProfiles,
  mockUseUpdateMyProfile,
  mockUseDeactivateWorkforceAccount,
  mockUseProvisionWorkforceAccountInvite,
  mockUseReactivateWorkforceAccount,
  mockUseResendWorkforceAccountInvite,
  mockUseSetPendingInviteAccessProfiles,
  mockUseDeactivateEmployee,
  mockUseReactivateEmployee,
} = vi.hoisted(() => ({
  mockPush: vi.fn(),
  mockInvalidateQueries: vi.fn(),
  mockMutateAsync: vi.fn(),
  mockSearchParams: new URLSearchParams(),
  mockUseWorkforceAccountStatus: vi.fn(),
  mockUseAccessProfiles: vi.fn(),
  mockUseSetUserAccessProfiles: vi.fn(),
  mockUseUpdateMyProfile: vi.fn(),
  mockUseDeactivateWorkforceAccount: vi.fn(),
  mockUseProvisionWorkforceAccountInvite: vi.fn(),
  mockUseReactivateWorkforceAccount: vi.fn(),
  mockUseResendWorkforceAccountInvite: vi.fn(),
  mockUseSetPendingInviteAccessProfiles: vi.fn(),
  mockUseDeactivateEmployee: vi.fn(() => ({
    mutateAsync: vi.fn(),
    isLoading: false,
  })),
  mockUseReactivateEmployee: vi.fn(() => ({
    mutateAsync: vi.fn(),
    isLoading: false,
  })),
}));

vi.mock("next/link", () => ({
  default: ({ href, children, ...props }: any) => (
    <a href={typeof href === "string" ? href : String(href)} {...props}>
      {children}
    </a>
  ),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush }),
  useSearchParams: () => mockSearchParams,
}));

vi.mock("@repo/api/query", () => ({
  useApiQueryClient: () => ({
    invalidateQueries: mockInvalidateQueries,
  }),
}));

vi.mock("@repo/auth", () => ({
  canAccessCorePeople: (user: { roles?: string[] } | null) =>
    !!user?.roles?.includes("HRAdmin"),
  canAccessCoreTeam: (user: { roles?: string[] } | null) =>
    !!user?.roles?.includes("Manager"),
  canManageCoreAccessProfiles: (user: { roles?: string[] } | null) =>
    !!user?.roles?.includes("HRAdmin"),
}));

vi.mock("@/shell/tenant-context/core-tenant-context-provider", () => ({
  useTenantContext: () => ({
    tenantId: null,
    tenantSummary: null,
    isLoading: false,
    clearTenantContext: vi.fn(),
  }),
}));

vi.mock("@/components/ui/sheet", () => ({
  Sheet: ({ open, children }: any) => (open ? <div>{children}</div> : null),
  SheetContent: ({ children }: any) => <div>{children}</div>,
  SheetDescription: ({ children }: any) => <div>{children}</div>,
  SheetHeader: ({ children }: any) => <div>{children}</div>,
  SheetTitle: ({ children }: any) => <div>{children}</div>,
}));

vi.mock(
  "@/app/(pages)/employees/[id]/employee-profile-workspace-sheets",
  () => ({
    EmployeeEditDialog: ({
      open,
      employeeKey,
    }: {
      open: boolean;
      employeeKey: string;
    }) =>
      open ? (
        <div data-testid="employee-edit-dialog">{employeeKey}</div>
      ) : null,
  })
);

vi.mock("@/app/(pages)/employees/use-employees", () => ({
  useUpdateMyProfile: mockUseUpdateMyProfile,
  useDeactivateEmployee: mockUseDeactivateEmployee,
  useReactivateEmployee: mockUseReactivateEmployee,
}));

vi.mock("@/app/(pages)/employees/use-workforce-accounts", () => ({
  useDeactivateWorkforceAccount: mockUseDeactivateWorkforceAccount,
  useProvisionWorkforceAccountInvite: mockUseProvisionWorkforceAccountInvite,
  useReactivateWorkforceAccount: mockUseReactivateWorkforceAccount,
  useResendWorkforceAccountInvite: mockUseResendWorkforceAccountInvite,
  useSetPendingInviteAccessProfiles: mockUseSetPendingInviteAccessProfiles,
  useWorkforceAccountStatus: mockUseWorkforceAccountStatus,
}));

vi.mock("@/features/access/api/use-core-access", () => ({
  useAccessProfiles: mockUseAccessProfiles,
  useSetUserAccessProfiles: mockUseSetUserAccessProfiles,
}));

vi.mock("./employee-access-management-sheet", () => ({
  EmployeeAccessManagementSheet: ({ open }: { open: boolean }) =>
    open ? (
      <div data-testid="access-sheet">
        <button type="button">Resend invite</button>
      </div>
    ) : null,
}));

import type {
  EmployeeProfileDto,
  EmployeeReadinessSummaryDto,
  EmployeeReportingLinesDto,
  WorkforceAccountStatusDto,
} from "@/app/(pages)/employees/employee-roster.types";
import { getEmployeeFieldPolicy } from "@/features/employees/shared/employee-field-visibility";
import {
  EmployeeProfileWorkspace,
  type EmployeeProfileWorkspaceProps,
} from "./employee-profile-workspace";

function createMutationState() {
  return {
    isLoading: false,
    mutateAsync: mockMutateAsync,
  };
}

const completeReadiness: EmployeeReadinessSummaryDto = {
  employeeStateIssueCount: 0,
  blockingIssueCount: 0,
  employeeStateIssues: [],
  blockingIssues: [],
  hasEmployeeStateIssues: false,
  hasBlockingIssues: false,
};

const baseProfile: EmployeeProfileDto = {
  id: "emp-1",
  stableEmployeeKey: "E-EMP1",
  employeeNumber: "E-001",
  firstName: "Jordan",
  lastName: "Lee",
  preferredName: "Jordy",
  displayName: "Jordy Lee",
  fullName: "Jordan Lee",
  email: "jordan.lee@example.com",
  phone: "+44 20 0000 0000",
  jobTitle: "People Operations Manager",
  workLocation: "London",
  employmentType: "Full-time",
  hireDate: "2022-04-05T00:00:00.000Z",
  status: "Active",
  orgUnitId: "ou-1",
  orgUnitName: "People Operations",
  orgUnitType: "Department",
  managerId: "mgr-1",
  managerFirstName: "Morgan",
  managerLastName: "Hart",
  managerEmail: "morgan.hart@example.com",
  managerFullName: "Morgan Hart",
  hierarchyStatus: "Healthy",
  directReportCount: 2,
  readiness: completeReadiness,
  createdAt: "2024-05-10T12:00:00.000Z",
  updatedAt: "2024-06-10T09:30:00.000Z",
  version: 7,
};

const baseReportingLines: EmployeeReportingLinesDto = {
  employee: {
    id: "emp-1",
    stableEmployeeKey: "E-EMP1",
    employeeNumber: "E-001",
    preferredName: "Jordy",
    displayName: "Jordy Lee",
    fullName: "Jordan Lee",
    firstName: "Jordan",
    lastName: "Lee",
    email: "jordan.lee@example.com",
    orgUnitId: "ou-1",
    orgUnitName: "People Operations",
    jobTitle: "People Operations Manager",
    status: "Active",
    hireDate: "2022-04-05T00:00:00.000Z",
    managerId: "mgr-1",
    managerName: "Morgan Hart",
    hierarchyStatus: "Healthy",
    directReportCount: 2,
    readiness: completeReadiness,
    version: 7,
  },
  managerChain: [
    {
      depth: 0,
      employee: {
        id: "mgr-1",
        stableEmployeeKey: "E-MGR1",
        employeeNumber: "E-010",
        preferredName: null,
        displayName: "Morgan Hart",
        fullName: "Morgan Hart",
        firstName: "Morgan",
        lastName: "Hart",
        email: "morgan.hart@example.com",
        orgUnitId: "ou-9",
        orgUnitName: "People Leadership",
        jobTitle: "Head of People",
        status: "Active",
        hireDate: "2020-01-01T00:00:00.000Z",
        managerId: null,
        managerName: null,
        hierarchyStatus: "Root",
        directReportCount: 5,
        readiness: completeReadiness,
        version: 3,
      },
    },
  ],
  directReports: [
    {
      depth: 1,
      employee: {
        id: "emp-2",
        stableEmployeeKey: "E-EMP2",
        employeeNumber: "E-002",
        preferredName: null,
        displayName: "Taylor Singh",
        fullName: "Taylor Singh",
        firstName: "Taylor",
        lastName: "Singh",
        email: "taylor.singh@example.com",
        orgUnitId: "ou-1",
        orgUnitName: "People Operations",
        jobTitle: "HR Advisor",
        status: "Active",
        hireDate: "2023-03-02T00:00:00.000Z",
        managerId: "emp-1",
        managerName: "Jordan Lee",
        hierarchyStatus: "Healthy",
        directReportCount: 0,
        readiness: completeReadiness,
        version: 2,
      },
    },
    {
      depth: 1,
      employee: {
        id: "emp-3",
        stableEmployeeKey: "E-EMP3",
        employeeNumber: "E-003",
        preferredName: null,
        displayName: "Avery Cole",
        fullName: "Avery Cole",
        firstName: "Avery",
        lastName: "Cole",
        email: "avery.cole@example.com",
        orgUnitId: "ou-1",
        orgUnitName: "People Operations",
        jobTitle: "People Analyst",
        status: "Inactive",
        hireDate: "2023-06-01T00:00:00.000Z",
        managerId: "emp-1",
        managerName: "Jordan Lee",
        hierarchyStatus: "Healthy",
        directReportCount: 0,
        readiness: completeReadiness,
        version: 1,
      },
    },
  ],
  downline: [],
  directReportCount: 2,
  downlineCount: 2,
};

const activeAccount: WorkforceAccountStatusDto = {
  employeeId: "emp-1",
  email: "jordan.lee@example.com",
  fullName: "Jordan Lee",
  role: "Employee",
  accessProfiles: [
    {
      id: "profile-1",
      name: "Manager",
      type: "SystemSeeded",
      isSystemProtected: true,
    },
  ],
  provisioningState: "Active",
  userId: "user-1",
  isActive: true,
  lastLoginAt: "2024-06-11T08:30:00.000Z",
  inviteId: null,
  inviteCreatedAt: null,
  inviteExpiresAt: null,
  inviteLink: null,
  deliveryStatus: null,
  deliveryMessage: null,
  conflict: null,
};

function renderWorkspace(
  overrides: Partial<EmployeeProfileWorkspaceProps> = {}
) {
  return render(
    <EmployeeProfileWorkspace
      profile={baseProfile}
      reportingLines={baseReportingLines}
      fieldPolicy={getEmployeeFieldPolicy(null, "hrAdmin")}
      user={
        {
          userId: "hr-1",
          employeeId: "emp-99",
          email: "hr@example.com",
          fullName: "HR Admin",
          roles: ["HRAdmin"],
        } as any
      }
      isTenantContextReadOnly={false}
      canManageEmployee={true}
      canManageReporting={true}
      canViewAccess={true}
      canManageAccess={true}
      canUseOrgChart={true}
      canEditOwnPreferredName={false}
      canEditOwnPhone={false}
      {...overrides}
    />
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  mockSearchParams.delete("sheet");
  mockUseAccessProfiles.mockReturnValue({
    data: [
      { id: "profile-1", name: "Manager" },
      { id: "profile-2", name: "Employee" },
    ],
  });
  mockUseWorkforceAccountStatus.mockReturnValue({
    data: activeAccount,
    error: null,
    isLoading: false,
  });
  mockUseSetUserAccessProfiles.mockReturnValue(createMutationState());
  mockUseUpdateMyProfile.mockReturnValue(createMutationState());
  mockUseDeactivateWorkforceAccount.mockReturnValue(createMutationState());
  mockUseProvisionWorkforceAccountInvite.mockReturnValue(createMutationState());
  mockUseReactivateWorkforceAccount.mockReturnValue(createMutationState());
  mockUseResendWorkforceAccountInvite.mockReturnValue(createMutationState());
  mockUseSetPendingInviteAccessProfiles.mockReturnValue(createMutationState());
  Object.defineProperty(window.HTMLElement.prototype, "scrollIntoView", {
    configurable: true,
    value: vi.fn(),
  });
});

describe("EmployeeProfileWorkspace", () => {
  it(
    "renders the rewritten HR profile layout with linked reporting and working edit actions",
    () => {
    renderWorkspace({
      profile: {
        ...baseProfile,
        hierarchyStatus: "NoManagerAssigned",
        readiness: {
          ...completeReadiness,
          employeeStateIssueCount: 1,
          hasEmployeeStateIssues: true,
          employeeStateIssues: [
            {
              code: "NoManagerAssigned",
              label: "No manager assigned",
              severity: "Attention",
              fieldKey: null,
              fixTarget: {
                kind: "ReportingRelationships",
                employeeId: "emp-1",
                importHistoryId: null,
                fieldKey: null,
              },
            },
          ],
        },
      },
    });

    expect(screen.getByText("Profile details")).toBeTruthy();
    expect(screen.getByText("Organization & reporting")).toBeTruthy();
    expect(screen.getByText("Access")).toBeTruthy();
    expect(screen.getByText("Record completeness")).toBeTruthy();
    expect(screen.queryByText("Recent activity")).toBeNull();

    const profileDetailsHeading = screen.getByText("Profile details");
    const accessHeading = screen.getByText("Access");
    const reportingHeading = screen.getByText("Organization & reporting");

    expect(
      profileDetailsHeading.compareDocumentPosition(accessHeading) &
        Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy();
    expect(
      accessHeading.compareDocumentPosition(reportingHeading) &
        Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy();

    const managerLinks = screen.getAllByRole("link", { name: /Morgan Hart/i });
    const managerHrefs = managerLinks.map((link) => link.getAttribute("href"));
    expect(managerHrefs).toContain("/employees/E-MGR1");

    const directReportLink = screen.getByRole("link", {
      name: /Taylor Singh/i,
    });
    expect(directReportLink.getAttribute("href")).toBe("/employees/E-EMP2");

    fireEvent.click(
      screen.getAllByRole("button", { name: "Edit record" })[0]!
    );

    expect(screen.getByTestId("employee-edit-dialog")).toBeTruthy();
    expect(screen.getByTestId("employee-edit-dialog").textContent).toBe(
      "E-EMP1"
    );
    expect(screen.queryByText("No follow-up needed")).toBeNull();
    },
    10000
  );

  it("opens access management for invite-pending account actions", async () => {
    mockUseWorkforceAccountStatus.mockReturnValue({
      data: {
        ...activeAccount,
        provisioningState: "InvitePending",
        userId: null,
        lastLoginAt: null,
        inviteId: "invite-1",
        inviteCreatedAt: "2024-06-11T08:30:00.000Z",
        inviteExpiresAt: "2024-06-18T08:30:00.000Z",
        inviteLink: "https://example.com/invite",
      },
      error: null,
      isLoading: false,
    });

    renderWorkspace();

    fireEvent.click(screen.getByRole("button", { name: "Manage access" }));

    expect(screen.getByRole("button", { name: "Resend invite" })).toBeTruthy();
  });

  it("routes readiness issues to the reporting sheet when the fix target is reporting", async () => {
    const user = userEvent.setup();

    renderWorkspace({
      profile: {
        ...baseProfile,
        hierarchyStatus: "NoManagerAssigned",
        readiness: {
          ...completeReadiness,
          employeeStateIssueCount: 1,
          hasEmployeeStateIssues: true,
          employeeStateIssues: [
            {
              code: "NoManagerAssigned",
              label: "No manager assigned",
              severity: "Attention",
              fieldKey: null,
              fixTarget: {
                kind: "ReportingRelationships",
                employeeId: "emp-1",
                importHistoryId: null,
                fieldKey: null,
              },
            },
          ],
        },
      },
    });

    expect(screen.getAllByText("No manager").length).toBeGreaterThan(0);

    await user.click(screen.getByRole("button", { name: "Open fix" }));

    expect(screen.getByTestId("employee-edit-dialog")).toBeTruthy();
  });

  it("shows the full direct reports list on the profile page", () => {
    renderWorkspace({
      profile: {
        ...baseProfile,
        directReportCount: 5,
      },
      reportingLines: {
        ...baseReportingLines,
        employee: {
          ...baseReportingLines.employee,
          directReportCount: 5,
        },
        directReports: [
          ...baseReportingLines.directReports,
          {
            depth: 1,
            employee: {
              id: "emp-4",
              stableEmployeeKey: "E-EMP4",
              employeeNumber: "E-004",
              preferredName: null,
              displayName: "Houda Ammar",
              fullName: "Houda Ammar",
              firstName: "Houda",
              lastName: "Ammar",
              email: "houda.ammar@eytunisia.example.com",
              orgUnitId: "ou-1",
              orgUnitName: "People Operations",
              jobTitle: "Accounts Payable Specialist",
              status: "Active",
              hireDate: "2023-08-01T00:00:00.000Z",
              managerId: "emp-1",
              managerName: "Jordan Lee",
              hierarchyStatus: "Healthy",
              directReportCount: 0,
              readiness: completeReadiness,
              version: 1,
            },
          },
          {
            depth: 1,
            employee: {
              id: "emp-5",
              stableEmployeeKey: "E-EMP5",
              employeeNumber: "E-005",
              preferredName: null,
              displayName: "Imen Benyahia",
              fullName: "Imen Benyahia",
              firstName: "Imen",
              lastName: "Benyahia",
              email: "imen.benyahia@eytunisia.example.com",
              orgUnitId: "ou-1",
              orgUnitName: "People Operations",
              jobTitle: "Senior Accountant",
              status: "Active",
              hireDate: "2023-09-01T00:00:00.000Z",
              managerId: "emp-1",
              managerName: "Jordan Lee",
              hierarchyStatus: "Healthy",
              directReportCount: 0,
              readiness: completeReadiness,
              version: 1,
            },
          },
          {
            depth: 1,
            employee: {
              id: "emp-6",
              stableEmployeeKey: "E-EMP6",
              employeeNumber: "E-006",
              preferredName: null,
              displayName: "Mehdi Frikha",
              fullName: "Mehdi Frikha",
              firstName: "Mehdi",
              lastName: "Frikha",
              email: "mehdi.frikha@eytunisia.example.com",
              orgUnitId: "ou-1",
              orgUnitName: "People Operations",
              jobTitle: "Financial Analyst",
              status: "Active",
              hireDate: "2023-10-01T00:00:00.000Z",
              managerId: "emp-1",
              managerName: "Jordan Lee",
              hierarchyStatus: "Healthy",
              directReportCount: 0,
              readiness: completeReadiness,
              version: 1,
            },
          },
        ],
        directReportCount: 5,
        downlineCount: 5,
      },
    });

    expect(screen.queryByText("Showing 4 of 5")).toBeNull();
    expect(screen.queryByText("Preview below")).toBeNull();
    expect(screen.getByText("Listed below")).toBeTruthy();
    expect(screen.getByText("Houda Ammar")).toBeTruthy();
    expect(screen.getByText("Imen Benyahia")).toBeTruthy();
    expect(screen.getByText("Mehdi Frikha")).toBeTruthy();
  });

  it("keeps deactivation blockers out of record completeness", () => {
    renderWorkspace({
      profile: {
        ...baseProfile,
        directReportCount: 5,
        readiness: {
          ...completeReadiness,
          blockingIssueCount: 1,
          hasBlockingIssues: true,
          blockingIssues: [
            {
              code: "DeactivationBlocked",
              label:
                "Employee cannot be deactivated while 5 active direct reports remain",
              severity: "Blocker",
              fieldKey: null,
              fixTarget: {
                kind: "ProfileStatus",
                employeeId: "emp-1",
                importHistoryId: null,
                fieldKey: null,
              },
            },
          ],
        },
      },
    });

    expect(screen.queryByText("Record completeness")).toBeNull();
    expect(screen.queryByText("Incomplete record")).toBeNull();
    expect(screen.queryByText("Deactivation blocked")).toBeNull();
    expect(
      screen.queryByText(
        "Employee cannot be deactivated while 5 active direct reports remain"
      )
    ).toBeNull();
  });

  it("keeps self view read-first and limits actions to self-service flows", async () => {
    const user = userEvent.setup();

    renderWorkspace({
      user: {
        userId: "emp-1",
        employeeId: "emp-1",
        email: "jordan.lee@example.com",
        fullName: "Jordan Lee",
        roles: [],
      } as any,
      canManageEmployee: false,
      canManageReporting: false,
      canViewAccess: false,
      canManageAccess: false,
      canUseOrgChart: false,
      canEditOwnPreferredName: true,
      canEditOwnPhone: true,
    });

    expect(
      screen.getByRole("button", { name: "Edit my details" })
    ).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Manage access" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Change manager" })).toBeNull();
    expect(
      screen.queryByRole("button", { name: "Change organization" })
    ).toBeNull();
    expect(screen.queryByRole("link", { name: /Morgan Hart/i })).toBeNull();

    await user.click(screen.getByRole("button", { name: "Edit my details" }));

    expect(screen.getAllByText("Edit my details").length).toBeGreaterThan(1);
    expect(screen.getByRole("button", { name: "Save changes" })).toBeTruthy();
  });
});
