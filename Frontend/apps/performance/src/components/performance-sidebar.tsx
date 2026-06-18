"use client";

import { usePathname } from "next/navigation";
import {
  BarChart2,
  Bell,
  CalendarRange,
  LayoutDashboard,
  Library,
} from "lucide-react";
import { AppSidebar, type NavSection } from "@repo/ui";
import { SidebarUserPanel } from "@repo/auth";

const PERFORMANCE_NAV: NavSection = {
  title: "Performance",
  items: [
    { label: "Dashboard", href: "/", icon: LayoutDashboard },
    { label: "Cycles", href: "/cycles", icon: CalendarRange },
    { label: "Objective library", href: "/objectives", icon: Library },
    { label: "Notifications", href: "/notifications", icon: Bell },
  ],
};

export function PerformanceSidebar() {
  const pathname = usePathname();
  const activePath = pathname.replace(/^\/performance/, "") || "/";

  return (
    <AppSidebar
      activeModule="Performance"
      activePath={activePath}
      sections={[PERFORMANCE_NAV]}
      brandIcon={BarChart2}
      brandTitle="EY Performance"
      brandSubtitle="Reviews & Goals"
      basePath="/performance"
      userPanel={(collapsed) => <SidebarUserPanel collapsed={collapsed} />}
    />
  );
}
