"use client";

import { usePathname } from "next/navigation";
import { BarChart3, Home, User } from "lucide-react";
import {
  FUSION_MODULES,
  ModuleSidebar,
  ShellUserPanel,
} from "@repo/ds/shell";
import {
  canAccessMyObjectives,
  canAccessTeamObjectives,
  canViewObjectivePlanningConfiguration,
  canViewPerformanceCampaigns,
  canViewPerformanceStrategy,
  hasAnyRole,
  PLATFORM_ADMIN_ROLE,
  useAuth,
} from "@repo/auth";
import {
  OVERVIEW_NAV,
  CAMPAIGNS_NAV,
  MY_OBJECTIVES_NAV,
  PLATFORM_ADMIN_NAV,
  STRATEGY_NAV,
  TEAM_OBJECTIVES_NAV,
  TENANT_CONFIGURATION_NAV,
} from "@/data/sidebar-nav";

export function PerformanceSidebar() {
  const pathname = usePathname();
  const activePath = pathname.replace(/^\/performance/, "") || "/";
  const { user, logout } = useAuth();
  const isPlatformAdmin = hasAnyRole(user, [PLATFORM_ADMIN_ROLE]);
  const canViewPlanningConfiguration = canViewObjectivePlanningConfiguration(user);
  const canViewCampaigns = canViewPerformanceCampaigns(user);
  const canAccessMine = canAccessMyObjectives(user);
  const canAccessTeam = canAccessTeamObjectives(user);
  const canViewStrategy = canViewPerformanceStrategy(user);

  return (
    <ModuleSidebar
      brandTitle="EY Performance"
      brandSubtitle="Performance workspace"
      brandIcon={BarChart3}
      activePath={activePath}
      sections={[
        OVERVIEW_NAV,
        ...(canAccessMine ? [MY_OBJECTIVES_NAV] : []),
        ...(canAccessTeam ? [TEAM_OBJECTIVES_NAV] : []),
        ...(canViewStrategy ? [STRATEGY_NAV] : []),
        ...(canViewCampaigns ? [CAMPAIGNS_NAV] : []),
        ...(canViewPlanningConfiguration ? [TENANT_CONFIGURATION_NAV] : []),
        ...(isPlatformAdmin ? [PLATFORM_ADMIN_NAV] : []),
      ]}
      modules={FUSION_MODULES}
      currentModuleKey="performance"
      userPanel={(collapsed) => (
        <ShellUserPanel
          collapsed={collapsed}
          name={user?.fullName}
          secondaryLabel={user?.roles?.[0]}
          links={[
            { label: "My profile", href: "/performance/profile", icon: User },
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
