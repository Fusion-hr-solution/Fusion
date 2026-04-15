"use client";

import { usePathname } from "next/navigation";
import { BrainCircuit } from "lucide-react";
import { AppSidebar } from "@repo/ui";
import { SidebarUserPanel, useAuth, canAccessCoreSetup } from "@repo/auth";
import { PEOPLE_NAV, ADMIN_NAV } from "@/data/sidebar-nav";

export function CoreSidebar() {
  const pathname = usePathname();
  const activePath = pathname.replace(/^\/core/, "") || "/";
  const { user } = useAuth();

  const sections = canAccessCoreSetup(user)
    ? [PEOPLE_NAV, ADMIN_NAV]
    : [
        PEOPLE_NAV,
        {
          ...ADMIN_NAV,
          items: ADMIN_NAV.items.filter((item) => item.href !== "/setup"),
        },
      ];

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
