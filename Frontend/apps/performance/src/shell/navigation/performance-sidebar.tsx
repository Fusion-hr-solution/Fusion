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
import { resolvePerformanceAccess } from "@/shell/performance-access";

export function PerformanceSidebar() {
  const pathname = usePathname();
  const activePath = pathname.replace(/^\/performance/, "") || "/";
  const { user, logout, isLoading: isAuthLoading } = useAuth();

  // Fail closed: while the session is unresolved `user` is null, so the
  // administration-only destinations stay hidden and never flash a control that
  // would then disappear. Once the session resolves they appear per the derived
  // permission ("hide, don't deny"), matching backend enforcement.
  const access = resolvePerformanceAccess(user);
  const canReview =
    access.canAdminister ||
    access.aggregateViewScope === "DirectReports" ||
    access.aggregateViewScope === "OrgUnit" ||
    access.aggregateViewScope === "Tenant";
  const overviewItems = OVERVIEW_NAV.items.filter((item) => {
    if (item.href === "/setup" || item.href === "/settings") return access.canAdminister;
    if (item.href === "/plan") return access.canParticipate;
    if (item.href === "/reviews") return canReview;
    if (item.href === "/contribution") return canReview || access.canPublishStrategy;
    return true;
  });

  return (
    <ModuleSidebar
      brandTitle="EY Performance"
      brandSubtitle="Workspace"
      brandIcon={BarChart3}
      activePath={activePath}
      sections={[{ ...OVERVIEW_NAV, items: overviewItems }]}
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
