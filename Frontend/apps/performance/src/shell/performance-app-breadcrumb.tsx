"use client";

import { usePathname } from "next/navigation";
import { AppBreadcrumb } from "@repo/ds/shell";
import { REVIEWS_NAV, GOALS_NAV } from "@/data/sidebar-nav";

const NAV_ITEMS = [...REVIEWS_NAV.items, ...GOALS_NAV.items];

export function PerformanceAppBreadcrumb() {
  const pathname = usePathname();
  return <AppBreadcrumb appName="Performance" pathname={pathname} navItems={NAV_ITEMS} />;
}
