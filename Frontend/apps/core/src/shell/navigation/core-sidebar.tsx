"use client";

import { usePathname } from "next/navigation";
import { BrainCircuit, Home, User } from "lucide-react";
import {
  FUSION_MODULES,
  ModuleSidebar,
  ShellUserPanel,
  type ShellNavSection,
} from "@repo/ds/shell";
import {
  useAuth,
  PLATFORM_ADMIN_ROLE,
  canSeeCoreAccessNavigation,
  canSeeCoreOrgChartNavigation,
  canSeeCoreSettingsNavigation,
  canSeeCoreSetupNavigation,
  canSeeOrganizationsNavigation,
} from "@repo/auth";
import { PEOPLE_NAV, ADMIN_NAV } from "@/data/sidebar-nav";
import { useCoreSetupAccess } from "@/shell/setup-access";
import { useTenantContext } from "@/shell/tenant-context/core-tenant-context-provider";
import {
  canSeeEmployeeRosterNavigation,
  canSeeSelfEmployeeProfileNavigation,
  canSeeTeamWorkspaceNavigation,
} from "@/lib/employee-roster-access";
import { buildTenantContextHref } from "@/lib/tenant-navigation";

function applyTenantContextHref(
  section: ShellNavSection,
  tenantId: string | null,
  tenantSlug: string | null
): ShellNavSection {
  if (!tenantId) return section;
  return {
    ...section,
    items: section.items.map((item) => ({
      ...item,
      // Module-relative (with tenant query); Next.js prepends the /core basePath.
      navigateHref: buildTenantContextHref(item.href, tenantId, tenantSlug),
    })),
  };
}

function applySetupLock(section: ShellNavSection, disabledReason: string): ShellNavSection {
  return {
    ...section,
    items: section.items.map((item) =>
      item.href === "/setup" ? item : { ...item, disabled: true, disabledReason }
    ),
  };
}

// Setup-lock state still resolving: lockable items look enabled but are inert,
// so they never flash interactive→locked. Setup itself is always navigable.
function applyPendingLock(section: ShellNavSection): ShellNavSection {
  return {
    ...section,
    items: section.items.map((item) =>
      item.href === "/setup" ? item : { ...item, pending: true }
    ),
  };
}

export function CoreSidebar() {
  const pathname = usePathname();
  const activePath = pathname.replace(/^\/core/, "") || "/";
  const { user, logout, isLoading: isAuthLoading } = useAuth();
  const { isNavigationLocked, lockedNavigationReason, isAccessResolving } =
    useCoreSetupAccess();
  const { tenantId, tenantSlug, tenantName } = useTenantContext();
  const isInTenantContext = !!tenantId;
  // Auth known but the setup-state query is still in flight: lock state unknown.
  const isLockStateResolving = !isAuthLoading && isAccessResolving;

  const canSeeSetup = canSeeCoreSetupNavigation(user) || isInTenantContext;
  const canSeeAccess = canSeeCoreAccessNavigation(user) || isInTenantContext;
  const canSeeSettings = canSeeCoreSettingsNavigation(user) || isInTenantContext;
  const canSeeOrganizations = canSeeOrganizationsNavigation(user) && !isInTenantContext;
  const canSeeEmployeeRoster = canSeeEmployeeRosterNavigation(user) || isInTenantContext;
  const canSeeOrgChart = canSeeCoreOrgChartNavigation(user) || isInTenantContext;
  const canSeeMyProfile = canSeeSelfEmployeeProfileNavigation(user) && !isInTenantContext;
  const canSeeMyTeam = canSeeTeamWorkspaceNavigation(user) && !isInTenantContext;

  const peopleItems = PEOPLE_NAV.items.filter((item) => {
    if (item.href === "/profile") return canSeeMyProfile;
    if (item.href === "/team") return canSeeMyTeam;
    if (item.href === "/employees") return canSeeEmployeeRoster;
    if (item.href === "/org-chart") return canSeeOrgChart;
    return true;
  });
  const adminItems = ADMIN_NAV.items.filter((item) => {
    if (item.href === "/setup") return canSeeSetup;
    if (item.href === "/access") return canSeeAccess;
    if (item.href === "/settings") return canSeeSettings;
    if (item.href === "/organizations") return canSeeOrganizations;
    return canSeeSetup;
  });

  const visibleSections = adminItems.length
    ? [
        { ...PEOPLE_NAV, items: peopleItems },
        { ...ADMIN_NAV, items: adminItems },
      ]
    : [{ ...PEOPLE_NAV, items: peopleItems }];

  const sections = (
    isNavigationLocked && lockedNavigationReason
      ? visibleSections.map((section) => applySetupLock(section, lockedNavigationReason))
      : isLockStateResolving
        ? visibleSections.map(applyPendingLock)
        : visibleSections
  ).map((section) => applyTenantContextHref(section, tenantId, tenantSlug));

  const roleLabel = user?.roles.includes(PLATFORM_ADMIN_ROLE)
    ? "Platform admin"
    : user?.accessProfiles?.[0]?.name ?? user?.roles?.[0] ?? undefined;

  return (
    <ModuleSidebar
      brandTitle="EY Core HR"
      brandSubtitle="Workforce system of record"
      brandIcon={BrainCircuit}
      activePath={activePath}
      sections={sections}
      pending={isAuthLoading}
      modules={FUSION_MODULES}
      currentModuleKey="core"
      contextLabel={isInTenantContext ? `Tenant · ${tenantName ?? "Viewing"}` : undefined}
      userPanel={(collapsed) => (
        <ShellUserPanel
          collapsed={collapsed}
          pending={isAuthLoading}
          name={user?.fullName}
          secondaryLabel={roleLabel}
          links={[
            // Raw anchors → include basePath explicitly. "Home" goes to the platform shell.
            ...(canSeeMyProfile ? [{ label: "My profile", href: "/core/profile", icon: User }] : []),
            { label: "Platform home", href: "/", icon: Home },
          ]}
          onSignOut={async () => {
            await logout();
            window.location.href = "/auth/signin";
          }}
        />
      )}
    />
  );
}
