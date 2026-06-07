// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const {
  mockInvalidateQueries,
  mockToastSuccess,
  mockUseAccessProfiles,
  mockUseDeactivateWorkforceAccount,
  mockUseProvisionWorkforceAccountInvite,
  mockUseReactivateWorkforceAccount,
  mockUseResendWorkforceAccountInvite,
  mockUseSetPendingInviteAccessProfiles,
  mockUseSetUserAccessProfiles,
  mockUseWorkforceAccountStatus,
} = vi.hoisted(() => ({
  mockInvalidateQueries: vi.fn(),
  mockToastSuccess: vi.fn(),
  mockUseAccessProfiles: vi.fn(),
  mockUseDeactivateWorkforceAccount: vi.fn(),
  mockUseProvisionWorkforceAccountInvite: vi.fn(),
  mockUseReactivateWorkforceAccount: vi.fn(),
  mockUseResendWorkforceAccountInvite: vi.fn(),
  mockUseSetPendingInviteAccessProfiles: vi.fn(),
  mockUseSetUserAccessProfiles: vi.fn(),
  mockUseWorkforceAccountStatus: vi.fn(),
}));

vi.mock("sonner", () => ({
  toast: {
    success: mockToastSuccess,
  },
}));

vi.mock("@repo/api/query", () => ({
  useApiQueryClient: () => ({
    invalidateQueries: mockInvalidateQueries,
  }),
}));

vi.mock("@/app/(pages)/employees/employee-confirm-dialog", () => ({
  EmployeeConfirmDialog: () => null,
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

import { EmployeeAccessManagementSheet } from "./employee-access-management-sheet";

const baseProps = {
  open: true,
  onOpenChange: vi.fn(),
  employeeId: "emp-1",
  displayName: "Alex Morgan",
  email: "alex.morgan@example.com",
  firstName: "Alex",
  lastName: "Morgan",
  directReportCount: 2,
  canManageAccess: true,
} as const;

const accessProfiles = [
  { id: "profile-1", name: "Employee" },
  { id: "profile-2", name: "Manager" },
];

function mockHooks({
  account = null,
  error = null,
}: {
  account?: Record<string, unknown> | null;
  error?: Error | null;
} = {}) {
  mockUseWorkforceAccountStatus.mockReturnValue({
    data: account,
    error,
    isLoading: false,
  });
  mockUseAccessProfiles.mockReturnValue({
    data: accessProfiles,
    isLoading: false,
  });
  mockUseSetUserAccessProfiles.mockReturnValue({
    mutateAsync: vi.fn().mockResolvedValue(undefined),
    isLoading: false,
  });
  mockUseSetPendingInviteAccessProfiles.mockReturnValue({
    mutateAsync: vi.fn().mockResolvedValue(undefined),
    isLoading: false,
  });
  mockUseProvisionWorkforceAccountInvite.mockReturnValue({
    mutateAsync: vi.fn().mockResolvedValue({
      deliveryStatus: "Sent",
    }),
    isLoading: false,
  });
  mockUseResendWorkforceAccountInvite.mockReturnValue({
    mutateAsync: vi.fn().mockResolvedValue({
      deliveryStatus: "Suppressed",
    }),
    isLoading: false,
  });
  mockUseReactivateWorkforceAccount.mockReturnValue({
    mutateAsync: vi.fn().mockResolvedValue(undefined),
    isLoading: false,
  });
  mockUseDeactivateWorkforceAccount.mockReturnValue({
    mutateAsync: vi.fn().mockResolvedValue(undefined),
    isLoading: false,
  });
}

describe("EmployeeAccessManagementSheet", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockHooks();
  });

  it("shows only invite-focused content in invite mode", () => {
    render(
      <EmployeeAccessManagementSheet
        {...baseProps}
        initialMode="invite"
      />
    );

    expect(
      screen.getByRole("dialog", { name: "Send invite" })
    ).toBeInTheDocument();
    expect(
      screen.getByText("Access profile")
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Send invite" })).toBeInTheDocument();
    expect(screen.queryByText("Invite pending")).not.toBeInTheDocument();
    expect(screen.queryByText("Other account actions")).not.toBeInTheDocument();
  });

  it("opens the compact profile dialog for pending accounts", () => {
    mockHooks({
      account: {
        employeeId: "emp-1",
        email: "alex.morgan@example.com",
        fullName: "Alex Morgan",
        role: "Manager",
        accessProfiles: [{ id: "profile-2", name: "Manager" }],
        provisioningState: "InvitePending",
        userId: null,
        isActive: false,
        lastLoginAt: null,
        inviteId: "invite-1",
        inviteCreatedAt: "2026-06-06T10:00:00.000Z",
        inviteExpiresAt: "2026-06-13T10:00:00.000Z",
        inviteLink: "https://fusion.test/invite",
        deliveryStatus: "Suppressed",
        deliveryMessage: null,
        conflict: null,
      },
    });

    render(
      <EmployeeAccessManagementSheet
        {...baseProps}
        initialMode="pending"
      />
    );

    expect(
      screen.getByRole("dialog", { name: "Update access profile" })
    ).toBeInTheDocument();
    expect(
      screen.getByText("Current access profile")
    ).toBeInTheDocument();
    expect(
      screen.getByText("New access profile")
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Update access profile" })
    ).toBeInTheDocument();
  });

  it("shows profile-focused content in the compact dialog in profile mode", () => {
    mockHooks({
      account: {
        employeeId: "emp-1",
        email: "alex.morgan@example.com",
        fullName: "Alex Morgan",
        role: "Manager",
        accessProfiles: [{ id: "profile-2", name: "Manager" }],
        provisioningState: "Active",
        userId: "user-1",
        isActive: true,
        lastLoginAt: "2026-06-05T12:00:00.000Z",
        inviteId: null,
        inviteCreatedAt: null,
        inviteExpiresAt: null,
        inviteLink: null,
        deliveryStatus: null,
        deliveryMessage: null,
        conflict: null,
      },
    });

    render(
      <EmployeeAccessManagementSheet
        {...baseProps}
        initialMode="profile"
      />
    );

    expect(
      screen.getByRole("dialog", { name: "Update access profile" })
    ).toBeInTheDocument();
    expect(
      screen.getByText("Current access profile")
    ).toBeInTheDocument();
    expect(
      screen.getByText("New access profile")
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Update access profile" })).toBeInTheDocument();
  });

  it("shows the exact review reason in review mode", () => {
    mockHooks({
      account: {
        employeeId: "emp-1",
        email: "alex.morgan@example.com",
        fullName: "Alex Morgan",
        role: "Manager",
        accessProfiles: [],
        provisioningState: "Conflict",
        userId: null,
        isActive: false,
        lastLoginAt: null,
        inviteId: null,
        inviteCreatedAt: null,
        inviteExpiresAt: null,
        inviteLink: null,
        deliveryStatus: null,
        deliveryMessage: null,
        conflict: {
          kind: "EmailAlreadyRegistered",
          message: "Email already linked to another account.",
          blocking: true,
          suggestedAction: "Contact platform admin.",
        },
      },
    });

    render(
      <EmployeeAccessManagementSheet
        {...baseProps}
        initialMode="review"
      />
    );

    expect(
      screen.getByRole("dialog", { name: "Needs review" })
    ).toBeInTheDocument();
    expect(screen.getAllByText("Needs review").length).toBeGreaterThan(0);
    expect(
      screen.getByText("Email already linked to another account.")
    ).toBeInTheDocument();
    expect(screen.queryByText("Account conflict")).not.toBeInTheDocument();
  });

  it("maps profile update failures to user-facing copy instead of raw errors", async () => {
    const user = userEvent.setup();
    const mutateAsync = vi
      .fn()
      .mockRejectedValue(new Error("raw backend details"));

    mockHooks({
      account: {
        employeeId: "emp-1",
        email: "alex.morgan@example.com",
        fullName: "Alex Morgan",
        role: "Manager",
        accessProfiles: [],
        provisioningState: "Active",
        userId: "user-1",
        isActive: true,
        lastLoginAt: "2026-06-05T12:00:00.000Z",
        inviteId: null,
        inviteCreatedAt: null,
        inviteExpiresAt: null,
        inviteLink: null,
        deliveryStatus: null,
        deliveryMessage: null,
        conflict: null,
      },
    });
    mockUseSetUserAccessProfiles.mockReturnValue({
      mutateAsync,
      isLoading: false,
    });

    render(
      <EmployeeAccessManagementSheet
        {...baseProps}
        initialMode="profile"
      />
    );

    await user.click(screen.getByRole("button", { name: "Update access profile" }));

    expect(
      await screen.findByText("Access profile could not be updated.")
    ).toBeInTheDocument();
    expect(screen.queryByText("raw backend details")).not.toBeInTheDocument();
  });
});
