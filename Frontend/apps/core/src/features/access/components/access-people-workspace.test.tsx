// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import "@testing-library/jest-dom/vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ComponentPropsWithoutRef, ReactNode } from "react";
import type {
  AccessProfileSummaryDto,
  WorkforceAccessSubjectSummaryDto,
} from "@repo/api";

const {
  mockApiGet,
  mockApiPost,
  mockCanAccessCoreAccess,
  mockCanManageCoreAccess,
  mockCanManageCoreAccessProfiles,
  mockClipboardWriteText,
  mockReplace,
  mockSearchParams,
  mockUseAccessProfiles,
  mockUseAccessSubjectSummary,
  mockUseAccessSubjects,
  mockUseAccessSubjectSelectionPreview,
  mockUseAuth,
  mockBulkInviteMutate,
  mockUseBulkProvisionWorkforceAccountInvites,
  mockUseBulkSetUserAccessProfiles,
  mockUseResendWorkforceAccountInvite,
} = vi.hoisted(() => ({
  mockApiGet: vi.fn(),
  mockApiPost: vi.fn(),
  mockCanAccessCoreAccess: vi.fn(),
  mockCanManageCoreAccess: vi.fn(),
  mockCanManageCoreAccessProfiles: vi.fn(),
  mockClipboardWriteText: vi.fn(),
  mockReplace: vi.fn(),
  mockSearchParams: new URLSearchParams(),
  mockUseAccessProfiles: vi.fn(),
  mockUseAccessSubjectSummary: vi.fn(),
  mockUseAccessSubjects: vi.fn(),
  mockUseAccessSubjectSelectionPreview: vi.fn(),
  mockUseAuth: vi.fn(),
  mockBulkInviteMutate: vi.fn(),
  mockUseBulkProvisionWorkforceAccountInvites: vi.fn(),
  mockUseBulkSetUserAccessProfiles: vi.fn(),
  mockUseResendWorkforceAccountInvite: vi.fn(),
}));

vi.mock("@repo/api", () => ({
  coreWorkforcePaths: {
    accessSubjects: () => "/corehr/workforce/access-subjects",
    accessSubjectsPreview: () => "/corehr/workforce/access-subjects/preview",
  },
  createPlatformApiClient: () => ({
    get: mockApiGet,
    post: mockApiPost,
  }),
}));

vi.mock("next/link", () => ({
  default: ({
    href,
    children,
    ...props
  }: {
    href: string | URL;
    children: ReactNode;
  } & ComponentPropsWithoutRef<"a">) => (
    <a href={typeof href === "string" ? href : String(href)} {...props}>
      {children}
    </a>
  ),
}));

vi.mock("next/navigation", () => ({
  usePathname: () => "/access",
  useRouter: () => ({
    replace: mockReplace,
    push: vi.fn(),
  }),
  useSearchParams: () => mockSearchParams,
}));

vi.mock("@repo/auth", () => ({
  canAccessCoreAccess: mockCanAccessCoreAccess,
  canManageCoreAccess: mockCanManageCoreAccess,
  canManageCoreAccessProfiles: mockCanManageCoreAccessProfiles,
  canAccessCorePeople: () => true,
  canAccessOwnCoreProfile: () => false,
  useAuth: mockUseAuth,
}));

vi.mock("@/lib/employee-roster-access", () => ({
  canAccessEmployeeProfile: () => true,
}));

vi.mock("@/app/(pages)/access/use-access-subjects", () => ({
  useAccessSubjectSummary: mockUseAccessSubjectSummary,
  useAccessSubjectSelectionPreview: mockUseAccessSubjectSelectionPreview,
  useAccessSubjects: mockUseAccessSubjects,
}));

vi.mock("@/app/(pages)/employees/use-workforce-accounts", () => ({
  useBulkProvisionWorkforceAccountInvites:
    mockUseBulkProvisionWorkforceAccountInvites,
  useResendWorkforceAccountInvite: mockUseResendWorkforceAccountInvite,
}));

vi.mock("@/features/access/api/use-core-access", () => ({
  useAccessProfiles: mockUseAccessProfiles,
  useBulkSetUserAccessProfiles: mockUseBulkSetUserAccessProfiles,
}));

vi.mock("@/features/employees/profile/employee-access-management-sheet", () => ({
  EmployeeAccessManagementSheet: ({
    open,
    displayName,
    initialMode,
  }: {
    open: boolean;
    displayName: string;
    initialMode?: string;
  }) =>
    open ? (
      <div data-testid="access-sheet">
        {displayName}:{initialMode ?? "none"}
      </div>
    ) : null,
}));

import AccessPeopleWorkspace, {
  BulkInviteDialog,
} from "./access-people-workspace";

const baseSubject: WorkforceAccessSubjectSummaryDto = {
  employeeId: "emp-1",
  stableEmployeeKey: "EMP-1",
  employeeNumber: "E-001",
  firstName: "Alex",
  lastName: "Morgan",
  preferredName: null,
  displayName: "Alex Morgan",
  workEmail: "alex.morgan@example.com",
  employmentStatus: "Active",
  isActive: true,
  directReportCount: 2,
  accessState: "ActiveAccount",
  accessStateLabel: "Active account",
  accessStateDetail: "Linked and active",
  accessProfiles: [{ id: "profile-1", name: "Employee" }],
  invitationLabel: "Accepted",
  lastActivityLabel: "Activated Jun 1",
  lastActivityAt: "2025-06-01T10:00:00.000Z",
  deliveryState: "Sent",
  reviewReason: null,
  provisioningState: "Active",
  userId: "user-1",
};

function createSubject(
  overrides: Partial<WorkforceAccessSubjectSummaryDto>
): WorkforceAccessSubjectSummaryDto {
  return {
    ...baseSubject,
    ...overrides,
  };
}

function createSubjects(
  count: number,
  overrides?: (index: number) => Partial<WorkforceAccessSubjectSummaryDto>
): WorkforceAccessSubjectSummaryDto[] {
  return Array.from({ length: count }, (_, index) =>
    createSubject({
      employeeId: `emp-${index + 1}`,
      stableEmployeeKey: `EMP-${index + 1}`,
      employeeNumber: `E-${String(index + 1).padStart(3, "0")}`,
      firstName: `Person${index + 1}`,
      lastName: "Selected",
      displayName: `Person ${index + 1}`,
      workEmail: `person${index + 1}@example.com`,
      accessState: "NotInvited",
      accessStateLabel: "Not invited",
      accessStateDetail: null,
      accessProfiles: [],
      invitationLabel: "Not sent",
      lastActivityLabel: "No activity",
      lastActivityAt: null,
      deliveryState: null,
      reviewReason: null,
      provisioningState: "Unprovisioned",
      userId: null,
      directReportCount: index % 3,
      isActive: true,
      ...overrides?.(index),
    })
  );
}

const accessProfiles: AccessProfileSummaryDto[] = [
  {
    id: "profile-1",
    name: "Employee",
    type: "SystemSeeded",
    isSystemProtected: true,
    description: null,
    assignedUserCount: 0,
    createdAt: "2026-06-01T00:00:00.000Z",
    updatedAt: null,
    version: 1,
    grants: [],
  },
  {
    id: "profile-2",
    name: "Manager",
    type: "SystemSeeded",
    isSystemProtected: true,
    description: null,
    assignedUserCount: 0,
    createdAt: "2026-06-01T00:00:00.000Z",
    updatedAt: null,
    version: 1,
    grants: [],
  },
];

const ALL_RESULTS_SELECTION_TIMEOUT_MS = 15_000;
const ACCESS_WORKSPACE_RENDER_TIMEOUT_MS = 30_000;

// Access workspace renders a large table and can exceed Vitest's default under CI contention.
vi.setConfig({ testTimeout: ACCESS_WORKSPACE_RENDER_TIMEOUT_MS });

function resetSearchParams() {
  Array.from(mockSearchParams.keys()).forEach((key) =>
    mockSearchParams.delete(key)
  );
}

function setSearchParams(params: Record<string, string>) {
  resetSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    mockSearchParams.set(key, value);
  });
}

function mockAccessHooks({
  items = [baseSubject],
  totalCount = items.length,
  selectionPreviewSubjects = [],
  canViewAccess = true,
  canManageAccess = true,
  canManageProfiles = true,
}: {
  items?: WorkforceAccessSubjectSummaryDto[];
  totalCount?: number;
  selectionPreviewSubjects?: WorkforceAccessSubjectSummaryDto[];
  canViewAccess?: boolean;
  canManageAccess?: boolean;
  canManageProfiles?: boolean;
} = {}) {
  mockCanAccessCoreAccess.mockReturnValue(canViewAccess);
  mockCanManageCoreAccess.mockReturnValue(canManageAccess);
  mockCanManageCoreAccessProfiles.mockReturnValue(canManageProfiles);

  mockUseAuth.mockReturnValue({
    user: {
      userId: "user-1",
      tenantId: "tenant-1",
      email: "alex.morgan@example.com",
      fullName: "Alex Morgan",
      roles: ["HRAdmin"],
      employeeId: "emp-1",
      accessProfiles: [],
      effectivePermissions: [],
    },
    isLoading: false,
  });

  mockUseAccessProfiles.mockReturnValue({
    data: accessProfiles,
    isLoading: false,
    error: null,
  });
  mockUseAccessSubjectSummary.mockReturnValue({
    data: {
      totalCount,
      notInvitedCount: items.filter((item) => item.accessState === "NotInvited")
        .length,
      invitePendingCount: items.filter(
        (item) => item.accessState === "InvitePending"
      ).length,
      activeAccountCount: items.filter(
        (item) => item.accessState === "ActiveAccount"
      ).length,
      needsReviewCount: items.filter((item) => item.accessState === "NeedsReview")
        .length,
    },
    isLoading: false,
    error: null,
  });
  mockUseAccessSubjects.mockReturnValue({
    data: {
      items,
      totalCount,
      page: 1,
      pageSize: 20,
      totalPages: 1,
      hasNextPage: false,
      hasPreviousPage: false,
    },
    isLoading: false,
    error: null,
    refetch: vi.fn(),
  });
  mockUseAccessSubjectSelectionPreview.mockImplementation((_, enabled) => ({
    data: enabled ? selectionPreviewSubjects : undefined,
    isLoading: !!enabled,
    error: null,
    refetch: vi.fn(),
  }));
  mockUseBulkProvisionWorkforceAccountInvites.mockReturnValue({
    mutateAsync: mockBulkInviteMutate,
    isLoading: false,
  });
  mockUseResendWorkforceAccountInvite.mockReturnValue({
    mutateAsync: vi.fn().mockResolvedValue({
      deliveryStatus: "Sent",
    }),
    isLoading: false,
  });
  mockUseBulkSetUserAccessProfiles.mockReturnValue({
    mutateAsync: vi.fn(),
    isLoading: false,
  });
}

describe("AccessPeopleWorkspace", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetSearchParams();
    mockAccessHooks();
    mockBulkInviteMutate.mockResolvedValue({
      items: [],
      totalRequested: 0,
      invitedCount: 0,
      refreshedCount: 0,
      alreadyActiveCount: 0,
      skippedCount: 0,
    });
    mockApiGet.mockResolvedValue({
      items: [baseSubject],
      totalCount: 1,
      page: 1,
      pageSize: 20,
      totalPages: 1,
      hasNextPage: false,
      hasPreviousPage: false,
    });
    mockApiPost.mockResolvedValue([
      {
        inviteLink: "https://fusion.test/invite",
        deliveryStatus: "Suppressed",
      },
    ]);
    Object.defineProperty(globalThis.navigator, "clipboard", {
      configurable: true,
      value: {
        writeText: mockClipboardWriteText,
      },
    });
  });

  it(
    "renders the normal access workspace without import context or tabs",
    () => {
      render(<AccessPeopleWorkspace />);

      expect(
        screen.queryByText(
          /ready to activate access for recently imported employees/i
        )
      ).not.toBeInTheDocument();
      expect(
        screen.queryByRole("tab", { name: /access profiles/i })
      ).not.toBeInTheDocument();
      expect(
        screen.queryByRole("link", { name: /^people$/i })
      ).not.toBeInTheDocument();
      expect(
        screen.getByRole("link", { name: /access profiles/i })
      ).toHaveAttribute("href", "/settings?tab=access-permissions");
      expect(
        screen.getByPlaceholderText("Search by name or email")
      ).toHaveValue("");
      expect(
        screen.getByRole("button", { name: "All employee statuses" })
      ).toBeInTheDocument();
      expect(
        screen.queryByRole("button", { name: "Advanced" })
      ).not.toBeInTheDocument();
      expect(screen.getByText("Alex Morgan")).toBeInTheDocument();
      expect(screen.queryByText("E-001")).not.toBeInTheDocument();
    },
    ACCESS_WORKSPACE_RENDER_TIMEOUT_MS
  );

  it("plumbs query params into the roster search and auto-focuses an employeeKey deep link", async () => {
    setSearchParams({
      search: "alex",
      access: "ActiveAccount",
      profileId: "profile-1",
      employeeStatus: "Active",
      employeeKey: "EMP-1",
      page: "3",
      pageSize: "10",
    });
    mockAccessHooks();

    render(<AccessPeopleWorkspace />);

    expect(
      screen.getByPlaceholderText("Search by name or email")
    ).toHaveValue("alex");
    expect(mockUseAccessSubjects).toHaveBeenCalledWith(
      {
        search: "alex",
        access: "ActiveAccount",
        profileId: "profile-1",
        employeeStatus: "Active",
        employeeKey: "EMP-1",
        page: 3,
        pageSize: 10,
      },
      true
    );

    await waitFor(() => {
      expect(screen.getByTestId("access-sheet")).toHaveTextContent(
        "Alex Morgan:profile"
      );
    });
  });

  it("shows state-driven row actions", () => {
    mockAccessHooks({
      items: [
        createSubject({
          employeeId: "emp-invite",
          accessState: "NotInvited",
          accessStateLabel: "Not invited",
          accessProfiles: [],
          provisioningState: "Unprovisioned",
          invitationLabel: "Not sent",
          lastActivityLabel: "No activity",
          userId: null,
        }),
        createSubject({
          employeeId: "emp-pending",
          accessState: "InvitePending",
          accessStateLabel: "Invite pending",
          invitationLabel: "Pending",
          provisioningState: "InvitePending",
          userId: null,
        }),
        createSubject({
          employeeId: "emp-active",
          accessState: "ActiveAccount",
          accessStateLabel: "Active account",
          provisioningState: "Active",
        }),
        createSubject({
          employeeId: "emp-review",
          accessState: "NeedsReview",
          accessStateLabel: "Needs review",
          accessStateDetail: "Email already linked to another account",
          accessProfiles: [],
          invitationLabel: "Email already linked to another account",
          lastActivityLabel: "No activity",
          provisioningState: "Conflict",
          userId: null,
        }),
      ],
    });

    render(<AccessPeopleWorkspace />);

    expect(screen.getByRole("button", { name: "Send invite" })).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Copy invite link" })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Update access profile" })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Review issue" })
    ).toBeInTheDocument();
  });

  it("copies the pending invite link directly from the row action", async () => {
    const user = userEvent.setup();
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(globalThis.navigator, "clipboard", {
      configurable: true,
      value: {
        writeText,
      },
    });
    mockAccessHooks({
      items: [
        createSubject({
          employeeId: "emp-pending",
          accessState: "InvitePending",
          accessStateLabel: "Invite pending",
          provisioningState: "InvitePending",
          invitationLabel: "Pending",
          userId: null,
        }),
      ],
    });

    render(<AccessPeopleWorkspace />);

    await user.click(screen.getByRole("button", { name: "Copy invite link" }));

    await waitFor(() => {
      expect(writeText).toHaveBeenCalledWith("https://fusion.test/invite");
    });
    expect(screen.queryByTestId("access-sheet")).not.toBeInTheDocument();
  });

  it("shows honest current-page and matching-results selection wording", async () => {
    const user = userEvent.setup();
    mockAccessHooks({ totalCount: 2 });

    render(<AccessPeopleWorkspace />);

    await user.click(screen.getByRole("checkbox", { name: /select alex morgan/i }));

    expect(screen.getByText("1 selected")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Select all 2" })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Select all 2" }));

    await waitFor(() => {
      expect(
        screen.getByText("All 2 selected")
      ).toBeInTheDocument();
    });
  });

  it("shows a compact bulk invite review with selected count", () => {
    render(
      <BulkInviteDialog
        open
        onOpenChange={vi.fn()}
        subjects={[
          createSubject({
            employeeId: "emp-ready",
            accessState: "NotInvited",
            accessStateLabel: "Not invited",
            accessProfiles: [],
            provisioningState: "Unprovisioned",
            invitationLabel: "Not sent",
            lastActivityLabel: "No activity",
            userId: null,
          }),
          createSubject({
            employeeId: "emp-active",
            displayName: "Jamie Active",
            accessState: "ActiveAccount",
            accessStateLabel: "Active account",
            provisioningState: "Active",
            invitationLabel: "Accepted",
          }),
        ]}
        accessProfiles={accessProfiles}
        isSubmitting={false}
        onConfirm={vi.fn().mockResolvedValue({
          items: [],
          totalRequested: 2,
          invitedCount: 1,
          refreshedCount: 0,
          alreadyActiveCount: 1,
          skippedCount: 0,
        })}
      />
    );

    const dialog = screen.getByRole("dialog", {
      name: "Review invitations",
    });

    expect(within(dialog).getByText("Review invitations")).toBeInTheDocument();
    expect(
      within(dialog).getByText("Send invitations to 2 selected people.")
    ).toBeInTheDocument();
    expect(within(dialog).getByText("Selected")).toBeInTheDocument();
    expect(within(dialog).getByText("Will process")).toBeInTheDocument();
    expect(within(dialog).getByText("Skipped")).toBeInTheDocument();
    expect(
      within(dialog).getByText(
        /each person is assigned a suggested profile based on their role/i
      )
    ).toBeInTheDocument();
  });

  it(
    "hydrates the full selection before bulk invite review when all results are selected",
    async () => {
      const user = userEvent.setup();
      const visibleItems = createSubjects(2);
      const totalMatchingResults = 48;
      const previewSubjects = createSubjects(totalMatchingResults);
      mockAccessHooks({
        items: visibleItems,
        totalCount: totalMatchingResults,
        selectionPreviewSubjects: previewSubjects,
      });

      render(<AccessPeopleWorkspace />);

      for (const subject of visibleItems) {
        await user.click(
          screen.getByRole("checkbox", {
            name: `Select ${subject.displayName}`,
          })
        );
      }

      await user.click(
        await screen.findByRole("button", {
          name: `Select all ${totalMatchingResults}`,
        })
      );
      await user.click(
        await screen.findByRole("button", {
          name: `Send ${totalMatchingResults} invites`,
        })
      );

      await waitFor(() => {
        expect(
          screen.getByRole("dialog", { name: "Review invitations" })
        ).toBeInTheDocument();
      });

      const dialog = screen.getByRole("dialog", {
        name: "Review invitations",
      });

      expect(
        screen.getByText(
          `Send invitations to ${totalMatchingResults} selected people.`
        )
      ).toBeInTheDocument();
      expect(screen.getByText("Will process")).toBeInTheDocument();
      expect(screen.getAllByText(String(totalMatchingResults))).toHaveLength(2);

      mockBulkInviteMutate.mockResolvedValueOnce({
        items: [],
        totalRequested: totalMatchingResults,
        invitedCount: totalMatchingResults,
        refreshedCount: 0,
        alreadyActiveCount: 0,
        skippedCount: 0,
      });

      await user.click(
        within(dialog).getByRole("button", {
          name: `Send ${totalMatchingResults} invites`,
        })
      );

      await waitFor(() => {
        expect(mockBulkInviteMutate).toHaveBeenCalledWith(
          expect.objectContaining({
            accessProfileId: expect.any(String),
            specificEmployeeIds: previewSubjects.map(
              (subject) => subject.employeeId
            ),
          })
        );
      });
    },
    ALL_RESULTS_SELECTION_TIMEOUT_MS
  );

  it("shows 'Assigned on invite' for NotInvited rows without profiles", () => {
    mockAccessHooks({
      items: [
        createSubject({
          employeeId: "emp-2",
          accessState: "NotInvited",
          accessStateLabel: "Not invited",
          accessProfiles: [],
          invitationLabel: "Not sent",
          lastActivityLabel: "No activity",
          provisioningState: "Unprovisioned",
          userId: null,
        }),
      ],
    });

    render(<AccessPeopleWorkspace />);

    expect(screen.getByText("Assigned on invite")).toBeInTheDocument();
  });

  it("shows needs review reason in access state detail", () => {
    mockAccessHooks({
      items: [
        createSubject({
          employeeId: "emp-3",
          accessState: "NeedsReview",
          accessStateLabel: "Needs review",
          accessStateDetail: "Email already linked to another account",
          accessProfiles: [],
          invitationLabel: "Email already linked to another account",
          lastActivityLabel: "No activity",
          provisioningState: "Conflict",
          userId: null,
        }),
      ],
    });

    render(<AccessPeopleWorkspace />);

    expect(
      screen.getByText("Email already linked to another account")
    ).toBeInTheDocument();
  });

  it("shows retry button on error state", () => {
    mockUseAccessSubjects.mockReturnValue({
      data: undefined,
      error: new Error("Network error"),
      isLoading: false,
      refetch: vi.fn(),
    });

    render(<AccessPeopleWorkspace />);

    expect(
      screen.getByText("Access information could not be loaded.")
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Try again" })).toBeInTheDocument();
  });

  it("hides access profiles button for users without access-profile permission", () => {
    mockAccessHooks({
      canViewAccess: true,
      canManageAccess: false,
      canManageProfiles: false,
    });
    mockUseAuth.mockReturnValue({
      user: {
        userId: "user-2",
        tenantId: "tenant-1",
        email: "viewer@example.com",
        fullName: "Viewer User",
        roles: [],
        employeeId: "emp-2",
        accessProfiles: [],
        effectivePermissions: [],
      },
      isLoading: false,
    });

    render(<AccessPeopleWorkspace />);

    expect(
      screen.queryByRole("link", { name: /access profiles/i })
    ).not.toBeInTheDocument();
  });
});
