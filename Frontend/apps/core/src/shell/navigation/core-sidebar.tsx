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
  canSeeCoreAccessNavigation,
  canSeeCoreOrgChartNavigation,
  canSeeCoreSettingsNavigation,
  canSeeCoreSetupNavigation,
} from "@repo/auth";
import { PEOPLE_NAV, ADMIN_NAV } from "@/data/sidebar-nav";
import { useCoreSetupAccess } from "@/shell/setup-access";
import {
  canSeeEmployeeRosterNavigation,
  canSeeSelfEmployeeProfileNavigation,
  canSeeTeamWorkspaceNavigation,
} from "@/lib/employee-roster-access";

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
  // Auth known but the setup-state query is still in flight: lock state unknown.
  const isLockStateResolving = !isAuthLoading && isAccessResolving;

  const canSeeSetup = canSeeCoreSetupNavigation(user);
  const canSeeAccess = canSeeCoreAccessNavigation(user);
  const canSeeSettings = canSeeCoreSettingsNavigation(user);
  const canSeeEmployeeRoster = canSeeEmployeeRosterNavigation(user);
  const canSeeOrgChart = canSeeCoreOrgChartNavigation(user);
  const canSeeMyProfile = canSeeSelfEmployeeProfileNavigation(user);
  const canSeeMyTeam = canSeeTeamWorkspaceNavigation(user);

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
    return canSeeSetup;
  });

  const visibleSections = adminItems.length
    ? [
        { ...PEOPLE_NAV, items: peopleItems },
        { ...ADMIN_NAV, items: adminItems },
      ]
    : [{ ...PEOPLE_NAV, items: peopleItems }];

  const sections =
    isNavigationLocked && lockedNavigationReason
      ? visibleSections.map((section) => applySetupLock(section, lockedNavigationReason))
      : isLockStateResolving
        ? visibleSections.map(applyPendingLock)
        : visibleSections;

  const roleLabel =
    user?.accessProfiles?.[0]?.name ?? user?.roles?.[0] ?? undefined;

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
