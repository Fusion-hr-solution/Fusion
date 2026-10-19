"use client";

import { usePathname } from "next/navigation";
import { Home, BarChart3, User } from "@/lib/icons";
import { useAuth } from "@repo/auth";
import {
  FUSION_MODULES,
  filterModulesByEntitlement,
  ModuleSidebar,
  ShellUserPanel,
  type ShellNavSection,
} from "@repo/ds/shell";
import { ADMIN_NAV, CYCLE_FREE_ROUTES, PRIMARY_NAV, visiblePrimaryItems } from "@/data/sidebar-nav";
import { resolvePerformanceWorkspaceAccessState } from "@/shell/performance-workspace-access";
import { useSelectedCycleId, useWorkspaceContext } from "@/features/performance/api/use-workspace";
import { withCycle } from "@/lib/performance-routes";

export function PerformanceSidebar() {
  const { user, isLoading: isAuthLoading } = useAuth();

  // Destinations come from the server's workspace context for the selected Cycle — participation and
  // recorded review responsibility, not persona rules derived from claims. Until it resolves the rail
  // shows its pending state rather than flashing entries that might disappear ("hide, don't deny").
  const entitled = resolvePerformanceWorkspaceAccessState({ user, isLoading: isAuthLoading }) === "allowed";
  const context = useWorkspaceContext(entitled);
  const destinations = context.data?.destinations;
  const selectedCycleId = useSelectedCycleId();
  const carry = (section: ShellNavSection): ShellNavSection => ({
    ...section,
    items: section.items.map((item) => ({ ...item, navigateHref: CYCLE_FREE_ROUTES.has(item.href) ? item.href : withCycle(item.href, selectedCycleId) })),
  });

  const primaryItems = visiblePrimaryItems(destinations);

  const sections: ShellNavSection[] = [carry({ ...PRIMARY_NAV, items: primaryItems })];
  if (destinations?.cycleAdmin) sections.push(carry(ADMIN_NAV));

  return <SidebarFrame sections={sections} pending={isAuthLoading || (entitled && context.isLoading)} />;
}

function SidebarFrame({ sections, pending }: { sections: ShellNavSection[]; pending: boolean }) {
  const pathname = usePathname();
  const activePath = pathname.replace(/^\/performance/, "") || "/";
  const { user, logout, isLoading: isAuthLoading } = useAuth();
  return (
    <ModuleSidebar
      brandTitle="EY Performance"
      brandSubtitle="Workspace"
      brandIcon={BarChart3}
      activePath={activePath}
      sections={sections}
      pending={pending}
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
