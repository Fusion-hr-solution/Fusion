"use client";

import { usePathname } from "next/navigation";
import { BarChart3, Home, User } from "lucide-react";
import {
  FUSION_MODULES,
  ModuleSidebar,
  ShellUserPanel,
} from "@repo/ds/shell";
import { useAuth } from "@repo/auth";
import { REVIEWS_NAV, GOALS_NAV } from "@/data/sidebar-nav";

export function PerformanceSidebar() {
  const pathname = usePathname();
  const activePath = pathname.replace(/^\/performance/, "") || "/";
  const { user, logout } = useAuth();

  return (
    <ModuleSidebar
      brandTitle="EY Performance"
      brandSubtitle="Reviews & objectives"
      brandIcon={BarChart3}
      activePath={activePath}
      sections={[REVIEWS_NAV, GOALS_NAV]}
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
