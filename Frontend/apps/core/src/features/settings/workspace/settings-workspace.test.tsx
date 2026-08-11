// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import type { SettingsSectionDto } from "@repo/api";

const {
  mockPush,
  mockReplace,
  mockSearchParams,
  mockUseAccessAudit,
  mockUseAccessProfiles,
  mockUseOrganizationSettings,
  mockUsePeopleDataSettings,
  mockUseProvisioningSettings,
  mockUseSettingsAudit,
  mockUseSettingsSections,
  mockUseUpdateOrganizationSettings,
  mockUseUpdatePeopleDataSettings,
  mockUseUpdateProvisioningSettings,
} = vi.hoisted(() => ({
  mockPush: vi.fn(),
  mockReplace: vi.fn(),
  mockSearchParams: new URLSearchParams(),
  mockUseAccessAudit: vi.fn(),
  mockUseAccessProfiles: vi.fn(),
  mockUseOrganizationSettings: vi.fn(),
  mockUsePeopleDataSettings: vi.fn(),
  mockUseProvisioningSettings: vi.fn(),
  mockUseSettingsAudit: vi.fn(),
  mockUseSettingsSections: vi.fn(),
  mockUseUpdateOrganizationSettings: vi.fn(),
  mockUseUpdatePeopleDataSettings: vi.fn(),
  mockUseUpdateProvisioningSettings: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: mockPush,
    replace: mockReplace,
  }),
  useSearchParams: () => mockSearchParams,
}));

vi.mock("@repo/api", () => ({
  ApiError: class ApiError extends Error {
    status: number;
    errors: string[];

    constructor(errors: string[] = [], status = 500) {
      super(errors.join(", "));
      this.errors = errors;
      this.status = status;
    }
  },
}));

vi.mock("@/features/access/components/access-profiles-workspace", () => ({
  AccessProfilesWorkspace: () => <div>Access profiles panel</div>,
}));

vi.mock("@/features/access/api/use-core-access", () => ({
  useAccessAudit: mockUseAccessAudit,
  useAccessProfiles: mockUseAccessProfiles,
}));

vi.mock("@/features/settings/api/use-tenant-settings", () => ({
  useOrganizationSettings: mockUseOrganizationSettings,
  usePeopleDataSettings: mockUsePeopleDataSettings,
  useProvisioningSettings: mockUseProvisioningSettings,
  useSettingsAudit: mockUseSettingsAudit,
  useSettingsSections: mockUseSettingsSections,
  useUpdateOrganizationSettings: mockUseUpdateOrganizationSettings,
  useUpdatePeopleDataSettings: mockUseUpdatePeopleDataSettings,
  useUpdateProvisioningSettings: mockUseUpdateProvisioningSettings,
}));

vi.mock("sonner", () => ({
  toast: {
    error: vi.fn(),
    success: vi.fn(),
  },
}));

import SettingsWorkspace from "./settings-workspace";

function createSection(
  id: string,
  label: string,
  order: number,
  canManage = true
): SettingsSectionDto {
  return {
    id,
    moduleId: "core",
    group: "foundation",
    label,
    description: `${label} backend description`,
    enabled: true,
    status: "ready",
    statusLabel: "Core",
    owner: "Core",
    auditNamespace: `core.settings.${id}`,
    order,
    canView: true,
    canManage,
    requiredViewCapabilities: [],
    requiredManageCapabilities: [],
  };
}

const settingsSections: SettingsSectionDto[] = [
  createSection("overview", "Overview", 0),
  createSection("organization", "Organization", 10),
  createSection("people-data", "People data", 20),
  createSection("structure", "Organization structure", 30),
  createSection("access-permissions", "Access & permissions", 40),
  createSection("provisioning", "Provisioning", 50),
  createSection("governance", "Governance", 60),
];

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

function createQuery<T>(data: T) {
  return {
    data,
    error: null,
    isLoading: false,
    refetch: vi.fn(),
  };
}

function createMutation() {
  return {
    isLoading: false,
    mutateAsync: vi.fn(),
  };
}

function renderWorkspace() {
  return render(<SettingsWorkspace />);
}

describe("SettingsWorkspace", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetSearchParams();

    mockUseSettingsSections.mockReturnValue(createQuery(settingsSections));
    mockUseOrganizationSettings.mockReturnValue(
      createQuery({
        version: 1,
        displayName: "Acme Corp",
        locale: "en-GB",
        timeZone: "Europe/London",
        branding: {
          logoUrl: "",
          primaryColor: "#1a365d",
        },
        usesDefaultBranding: true,
      })
    );
    mockUsePeopleDataSettings.mockReturnValue(createQuery(null));
    mockUseProvisioningSettings.mockReturnValue(
      createQuery({
        version: 1,
        provisioning: {
          defaultAccessProfileId: null,
          inviteExpiryDays: 14,
          resendCooldownHours: 24,
          pendingInviteBehavior: "RefreshExisting",
        },
        downstreamConsumers: [],
      })
    );
    mockUseSettingsAudit.mockReturnValue(createQuery([]));
    mockUseAccessAudit.mockReturnValue(createQuery([]));
    mockUseAccessProfiles.mockReturnValue(createQuery([]));
    mockUseUpdateOrganizationSettings.mockReturnValue(createMutation());
    mockUseUpdatePeopleDataSettings.mockReturnValue(createMutation());
    mockUseUpdateProvisioningSettings.mockReturnValue(createMutation());
  });

  it("renders a clean settings nav with user-facing labels only", () => {
    renderWorkspace();

    const nav = screen.getByRole("navigation", { name: "Settings sections" });

    expect(within(nav).getByRole("button", { name: "Company" })).toBeInTheDocument();
    expect(
      within(nav).getByRole("button", { name: "Employee fields" })
    ).toBeInTheDocument();
    expect(
      within(nav).getByRole("button", { name: "Access profiles" })
    ).toBeInTheDocument();
    expect(within(nav).getByRole("button", { name: "Invitations" })).toBeInTheDocument();
    expect(within(nav).getByRole("button", { name: "Audit log" })).toBeInTheDocument();
    expect(within(nav).queryByText("Overview")).not.toBeInTheDocument();
    expect(
      within(nav).queryByText("Organization structure")
    ).not.toBeInTheDocument();
    expect(within(nav).queryByText("Core")).not.toBeInTheDocument();
    expect(within(nav).queryByText("Manage")).not.toBeInTheDocument();
  });

  it.each(["structure", "organization-structure"])(
    "redirects %s deep links to Organization",
    async (tab) => {
      setSearchParams({ tab });

      renderWorkspace();

      await waitFor(() => {
        expect(mockReplace).toHaveBeenCalledWith("/organization", { scroll: false });
      });
    }
  );

  it("redirects overview links to the first actionable settings section", async () => {
    setSearchParams({ tab: "overview" });

    renderWorkspace();

    expect(
      screen.getByRole("heading", { name: "Company" })
    ).toBeInTheDocument();
    await waitFor(() => {
      expect(mockReplace).toHaveBeenCalledWith("?tab=organization", {
        scroll: false,
      });
    });
  });

  it("falls back from unknown tabs to the first actionable settings section", async () => {
    setSearchParams({ tab: "does-not-exist" });

    renderWorkspace();

    expect(
      screen.getByRole("heading", { name: "Company" })
    ).toBeInTheDocument();
    await waitFor(() => {
      expect(mockReplace).toHaveBeenCalledWith("?tab=organization", {
        scroll: false,
      });
    });
  });

  it("hides save actions while unchanged and shows them after edits", () => {
    renderWorkspace();

    expect(
      screen.queryByRole("button", { name: "Save changes" })
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Cancel" })
    ).not.toBeInTheDocument();
    expect(screen.queryByText("Current")).not.toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Primary color"), {
      target: { value: "#123456" },
    });

    expect(
      screen.getByRole("button", { name: "Save changes" })
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Cancel" })).toBeInTheDocument();
    expect(screen.queryByText("Current")).not.toBeInTheDocument();
  });
});
