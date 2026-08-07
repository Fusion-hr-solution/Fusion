"use client";

import { usePathname } from "next/navigation";
import { BrainCircuit, Home, User } from "lucide-react";
import {
  FUSION_MODULES,
  filterModulesByEntitlement,
  ModuleSidebar,
  ShellUserPanel,
} from "@repo/ds/shell";
import {
  useAuth,
  canSeeCoreAccessNavigation,
  canSeeCoreOrgChartNavigation,
  canSeeCoreSettingsNavigation,
  canViewTenantAdministration,
  getSidebarAccountLabel,
} from "@repo/auth";
import { PEOPLE_NAV, ADMIN_NAV } from "@/data/sidebar-nav";
import {
  canSeeEmployeeRosterNavigation,
  canSeeSelfEmployeeProfileNavigation,
  canSeeTeamWorkspaceNavigation,
} from "@/lib/employee-roster-access";

// Navigation is no longer gated on setup completion. A destination that has a
// real prerequisite says so itself, in its own words, at the point the user tries
// to act — which is both more useful and more truthful than disabling most of the
// product behind one generic sentence.

export function CoreSidebar() {
  const pathname = usePathname();
  const activePath = pathname.replace(/^\/core/, "") || "/";
  const { user, logout, isLoading: isAuthLoading } = useAuth();
  const canSeeSetup = canViewTenantAdministration(user);
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
    if (item.href === "/tenant-setup") return canSeeSetup;
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

  const roleLabel = user ? getSidebarAccountLabel(user) : undefined;

  return (
    <ModuleSidebar
      brandTitle="EY Core HR"
      brandSubtitle="Workforce system of record"
      brandIcon={BrainCircuit}
      activePath={activePath}
      sections={visibleSections}
      pending={isAuthLoading}
      modules={filterModulesByEntitlement(FUSION_MODULES, user?.moduleEntitlements ?? [])}
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
            { label: "Fusion home", href: "/", icon: Home },
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
