"use client";

import { usePathname } from "next/navigation";
import { BrainCircuit } from "lucide-react";
import { AppSidebar } from "@repo/ui";
import { SidebarUserPanel } from "@repo/auth";
import { PEOPLE_NAV, ADMIN_NAV } from "@/data/sidebar-nav";

export function CoreSidebar() {
  const pathname = usePathname();
  const activePath = pathname.replace(/^\/core/, "") || "/";

  return (
    <AppSidebar
      activeModule="Core"
      activePath={activePath}
      sections={[PEOPLE_NAV, ADMIN_NAV]}
      brandIcon={BrainCircuit}
      brandTitle="EY Core HR"
      brandSubtitle="HR Platform"
      basePath="/core"
      userPanel={(collapsed) => <SidebarUserPanel collapsed={collapsed} />}
    />
  );
}
