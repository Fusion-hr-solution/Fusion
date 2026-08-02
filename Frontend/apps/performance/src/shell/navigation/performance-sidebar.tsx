"use client";

import { usePathname } from "next/navigation";
import { Home, BarChart3, User } from "lucide-react";
import { useAuth } from "@repo/auth";
import {
  FUSION_MODULES,
  filterModulesByEntitlement,
  ModuleSidebar,
  ShellUserPanel,
} from "@repo/ds/shell";
import { OVERVIEW_NAV } from "@/data/sidebar-nav";

export function PerformanceSidebar() {
  const pathname = usePathname();
  const activePath = pathname.replace(/^\/performance/, "") || "/";
  const { user, logout, isLoading: isAuthLoading } = useAuth();

  return (
    <ModuleSidebar
      brandTitle="EY Performance"
      brandSubtitle="Workspace"
      brandIcon={BarChart3}
      activePath={activePath}
      sections={[OVERVIEW_NAV]}
      pending={isAuthLoading}
      modules={filterModulesByEntitlement(FUSION_MODULES, user?.moduleEntitlements ?? [])}
      currentModuleKey="performance"
      userPanel={(collapsed) => (
        <ShellUserPanel
          collapsed={collapsed}
          pending={isAuthLoading}
          name={user?.fullName}
          secondaryLabel={user?.roles?.[0]}
          links={[
            { label: "My profile", href: "/core/profile", icon: User },
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
