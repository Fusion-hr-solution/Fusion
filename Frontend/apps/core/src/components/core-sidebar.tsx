"use client";

import { usePathname } from "next/navigation";
import { BrainCircuit } from "lucide-react";
import { AppSidebar, type NavSection } from "@repo/ui";
import { SidebarUserPanel, useAuth, canSeeCoreSetupNavigation } from "@repo/auth";
import { PEOPLE_NAV, ADMIN_NAV } from "@/data/sidebar-nav";
import { useCoreSetupAccess } from "@/components/core-setup-access";

function applySetupLock(section: NavSection, disabledReason: string): NavSection {
  return {
    ...section,
    items: section.items.map((item) =>
      item.href === "/setup"
        ? item
        : {
            ...item,
            disabled: true,
            disabledReason,
          }
    ),
  };
}

export function CoreSidebar() {
  const pathname = usePathname();
  const activePath = pathname.replace(/^\/core/, "") || "/";
  const { user } = useAuth();
  const { isNavigationLocked, lockedNavigationReason } = useCoreSetupAccess();

  const visibleSections = canSeeCoreSetupNavigation(user)
    ? [PEOPLE_NAV, ADMIN_NAV]
    : [
        PEOPLE_NAV,
        {
          ...ADMIN_NAV,
          items: ADMIN_NAV.items.filter((item) => item.href !== "/setup"),
        },
      ];

  const sections =
    isNavigationLocked && lockedNavigationReason
      ? visibleSections.map((section) =>
          applySetupLock(section, lockedNavigationReason)
        )
      : visibleSections;

  return (
    <AppSidebar
      activeModule="Core"
      activePath={activePath}
      sections={sections}
      brandIcon={BrainCircuit}
      brandTitle="EY Core HR"
      brandSubtitle="HR Platform"
      basePath="/core"
      userPanel={(collapsed) => <SidebarUserPanel collapsed={collapsed} />}
    />
  );
}
