"use client";

import { usePathname } from "next/navigation";
import { User } from "@/lib/icons";
import { useFusionNavigation } from "@repo/api/query";
import { useFusionViewer } from "@repo/api/react";
import { useAuth } from "@repo/auth";
import { FusionSidebar, sectionPaths, type ShellNavSection } from "@repo/ds/shell";
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
  const { logout, isLoading: isAuthLoading } = useAuth();
  const { viewer } = useFusionViewer();
  const navigation = useFusionNavigation("performance", sectionPaths("/performance", sections));
  return (
    <FusionSidebar
      tenantName={navigation.tenantName}
      homeCount={navigation.homeCount}
      modules={navigation.modules}
      currentModuleKey="performance"
      basePath="/performance"
      activePath={activePath}
      sections={sections}
      sectionCounts={navigation.sectionCounts}
      pending={pending}
      recent={navigation.recent}
      person={{
        ...navigation.person,
        pending: isAuthLoading,
        links: viewer?.canOpenOwnProfile ? [{ label: "My profile", href: "/core/profile", icon: User }] : [],
        onSignOut: async () => {
          await logout();
          window.location.href = "/auth/signin";
        },
      }}
    />
  );
}
