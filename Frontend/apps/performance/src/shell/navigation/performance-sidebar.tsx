"use client";

import { usePathname } from "next/navigation";
import { BarChart3, Home, User } from "lucide-react";
import {
  FUSION_MODULES,
  ModuleSidebar,
  ShellUserPanel,
} from "@repo/ds/shell";
import {
  canSeeOwnCoreProfileNavigation,
  useAuth,
} from "@repo/auth";
import {
  OVERVIEW_NAV,
  getPerformanceDoors,
} from "@/data/sidebar-nav";

export function PerformanceSidebar() {
  const pathname = usePathname();
  const activePath = pathname.replace(/^\/performance/, "") || "/";
  const { user, logout, isLoading: isAuthLoading } = useAuth();
  const canSeeOwnProfile = canSeeOwnCoreProfileNavigation(user);
  const doors = getPerformanceDoors(user);

  return (
    <ModuleSidebar
      brandTitle="EY Performance"
      brandSubtitle="Performance workspace"
      brandIcon={BarChart3}
      activePath={activePath}
      pending={isAuthLoading}
      sections={[
        OVERVIEW_NAV,
        ...doors.map((door) => door.section),
      ]}
      modules={FUSION_MODULES}
      currentModuleKey="performance"
      userPanel={(collapsed) => (
        <ShellUserPanel
          collapsed={collapsed}
          pending={isAuthLoading}
          name={user?.fullName}
          secondaryLabel={user?.roles?.[0]}
          links={[
            // Raw anchors → include basePath explicitly. Core owns the employee
            // profile surface; Performance has no profile route of its own.
            ...(canSeeOwnProfile
              ? [{ label: "My profile", href: "/core/profile", icon: User }]
              : []),
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
