"use client";

import { usePathname } from "next/navigation";
import {
  BarChart2,
  ClipboardList,
  Target,
  TrendingUp,
} from "lucide-react";
import { AppSidebar, type NavSection } from "@repo/ui";

const PERFORMANCE_NAV: NavSection = {
  title: "Performance",
  items: [
    { label: "Reviews", href: "/", icon: ClipboardList },
    { label: "Goals", href: "/goals", icon: Target },
    { label: "Analytics", href: "/analytics", icon: TrendingUp },
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
    />
  );
}
