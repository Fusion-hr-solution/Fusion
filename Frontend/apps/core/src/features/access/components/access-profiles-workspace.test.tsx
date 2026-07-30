// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ComponentPropsWithoutRef, ReactNode } from "react";

const {
  mockCanManageCoreAccessProfiles,
  mockCanViewCoreAccessProfiles,
  mockUseAccessProfiles,
  mockUseAuth,
  mockUseCorePermissionCatalog,
  mockUseCreateAccessProfile,
  mockUseDeleteAccessProfile,
  mockUseUpdateAccessProfile,
} = vi.hoisted(() => ({
  mockCanManageCoreAccessProfiles: vi.fn(),
  mockCanViewCoreAccessProfiles: vi.fn(),
  mockUseAccessProfiles: vi.fn(),
  mockUseAuth: vi.fn(),
  mockUseCorePermissionCatalog: vi.fn(),
  mockUseCreateAccessProfile: vi.fn(),
  mockUseDeleteAccessProfile: vi.fn(),
  mockUseUpdateAccessProfile: vi.fn(),
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

vi.mock("@repo/api", () => ({
  ApiError: class ApiError extends Error {
    errors: string[];

    constructor(errors: string[]) {
      super(errors.join(", "));
      this.errors = errors;
    }
  },
}));

vi.mock("@repo/auth", () => ({
  canManageCoreAccessProfiles: mockCanManageCoreAccessProfiles,
  canViewCoreAccessProfiles: mockCanViewCoreAccessProfiles,
  useAuth: mockUseAuth,
}));

vi.mock("@/features/access/api/use-core-access", () => ({
  useAccessProfiles: mockUseAccessProfiles,
  useCorePermissionCatalog: mockUseCorePermissionCatalog,
  useCreateAccessProfile: mockUseCreateAccessProfile,
  useDeleteAccessProfile: mockUseDeleteAccessProfile,
  useUpdateAccessProfile: mockUseUpdateAccessProfile,
}));

vi.mock("sonner", () => ({
  toast: {
    error: vi.fn(),
    success: vi.fn(),
  },
}));

import { AccessProfilesWorkspace } from "./access-profiles-workspace";

describe("AccessProfilesWorkspace", () => {
  it("keeps assignments as an Access deep link in Settings", async () => {
    const user = userEvent.setup();

    mockUseAuth.mockReturnValue({ user: { userId: "user-1" } });
    mockCanViewCoreAccessProfiles.mockReturnValue(true);
    mockCanManageCoreAccessProfiles.mockReturnValue(true);
    mockUseCorePermissionCatalog.mockReturnValue({
      data: [
        {
          permissionKey: "core.settings.manage",
          label: "Manage settings",
          group: "Settings",
          helperText: null,
          allowedScopes: ["Tenant"],
        },
      ],
      isLoading: false,
    });
    mockUseAccessProfiles.mockReturnValue({
      data: [
        {
          id: "profile-1",
          name: "Core Admin",
          description: "Core administration",
          type: "Custom",
          isSystemProtected: false,
          assignedUserCount: 2,
          createdAt: "2026-01-01T00:00:00Z",
          updatedAt: null,
          version: 1,
          grants: [
            {
              permissionKey: "core.settings.manage",
              scope: "Tenant",
              label: "Manage settings",
              group: "Settings",
              helperText: null,
              allowedScopes: ["Tenant"],
            },
          ],
        },
      ],
      isLoading: false,
    });
    mockUseCreateAccessProfile.mockReturnValue({
      mutateAsync: vi.fn(),
      isLoading: false,
    });
    mockUseUpdateAccessProfile.mockReturnValue({
      mutateAsync: vi.fn(),
      isLoading: false,
    });
    mockUseDeleteAccessProfile.mockReturnValue({
      mutateAsync: vi.fn(),
      isLoading: false,
    });

    render(<AccessProfilesWorkspace embedded />);

    await user.click(await screen.findByText("Settings"));

    expect(await screen.findByText("Whole organization")).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: /manage assignments/i })
    ).toHaveAttribute("href", "/access?profileId=profile-1");
    expect(screen.queryByPlaceholderText("Search people")).not.toBeInTheDocument();
    expect(screen.queryByText("Available to assign")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Assign" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Remove" })).not.toBeInTheDocument();
  });
});
