"use client";

import { usePathname } from "next/navigation";
import {
  BrainCircuit,
  Building2,
  LayoutDashboard,
  Palette,
  Settings,
  Shield,
  Users,
} from "lucide-react";
import { AppSidebar, type NavSection } from "@repo/ui";
import { SidebarUserPanel } from "@repo/auth";
import { PLATFORM_MODULES } from "@/config/platform-modules";

const CORE_NAV: NavSection = {
  title: "Administration",
  items: [
    { label: "Dashboard", href: "/", icon: LayoutDashboard },
    { label: "Employees", href: "/employees", icon: Users },
    { label: "Settings", href: "/settings", icon: Settings },
    { label: "Security", href: "/security", icon: Shield },
  ],
};

const CORE_HR_NAV: NavSection = {
  title: "Core HR",
  items: [
    { label: "Organizations", href: "/organizations", icon: Building2 },
    { label: "Design system", href: "/design-system", icon: Palette },
  ],
};

/** Maps nested executive-console routes to sidebar nav hrefs (exact match in AppSidebar). */
function normalizeCoreActivePath(pathname: string): string {
  const p = pathname.replace(/^\/core/, "") || "/";
  if (p.startsWith("/organizations")) return "/organizations";
  if (p.startsWith("/design-system")) return "/design-system";
  return p;
}

export function CoreSidebar() {
  const pathname = usePathname();
  const activePath = normalizeCoreActivePath(pathname || "/");

  return (
    <AppSidebar
      activeModule="Core"
      activePath={activePath}
      sections={[CORE_NAV, CORE_HR_NAV]}
      brandIcon={BrainCircuit}
      brandTitle="EY Core"
      brandSubtitle="Platform Admin"
      basePath="/core"
      modules={PLATFORM_MODULES}
      userPanel={(collapsed) => <SidebarUserPanel collapsed={collapsed} />}
    />
  );
}
