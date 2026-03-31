"use client";

import { usePathname } from "next/navigation";
import { BrainCircuit, LayoutDashboard, Settings, Shield, Users } from "lucide-react";
import { AppSidebar, type NavSection } from "@repo/ui";
import { SidebarUserPanel } from "@repo/auth";

const CORE_NAV: NavSection = {
  title: "Administration",
  items: [
    { label: "Dashboard", href: "/", icon: LayoutDashboard },
    { label: "Employees", href: "/employees", icon: Users },
    { label: "Settings", href: "/settings", icon: Settings },
    { label: "Security", href: "/security", icon: Shield },
  ],
};

export function CoreSidebar() {
  const pathname = usePathname();
  const activePath = pathname.replace(/^\/core/, "") || "/";

  return (
    <AppSidebar
      activeModule="Core"
      activePath={activePath}
      sections={[CORE_NAV]}
      brandIcon={BrainCircuit}
      brandTitle="EY Core"
      brandSubtitle="Platform Admin"
      basePath="/core"
      userPanel={(collapsed) => <SidebarUserPanel collapsed={collapsed} />}
    />
  );
}
