"use client";

import { usePathname } from "next/navigation";
import { BarChart3, Home, User } from "lucide-react";
import {
  FUSION_MODULES,
  ModuleSidebar,
  ShellUserPanel,
} from "@repo/ds/shell";
import { hasAnyRole, hasCorePermission, PLATFORM_ADMIN_ROLE, useAuth } from "@repo/auth";
import { REVIEWS_NAV, HR_ADMIN_NAV, PLATFORM_ADMIN_NAV } from "@/data/sidebar-nav";

export function PerformanceSidebar() {
  const pathname = usePathname();
  const activePath = pathname.replace(/^\/performance/, "") || "/";
  const { user, logout } = useAuth();
  const isPlatformAdmin = hasAnyRole(user, [PLATFORM_ADMIN_ROLE]);
  const canViewPolicyArea =
    hasCorePermission(user, "performance.objective.policy.view", "Tenant") ||
    hasCorePermission(user, "performance.objective.policy.manage", "Tenant") ||
    hasCorePermission(user, "performance.template.view", "Tenant") ||
    hasCorePermission(user, "performance.template.manage", "Tenant");

  return (
    <ModuleSidebar
      brandTitle="EY Performance"
      brandSubtitle="Reviews & objectives"
      brandIcon={BarChart3}
      activePath={activePath}
      sections={[
        REVIEWS_NAV,
        ...(canViewPolicyArea ? [HR_ADMIN_NAV] : []),
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
