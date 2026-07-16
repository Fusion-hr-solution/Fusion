"use client";

import { usePathname } from "next/navigation";
import { AppBreadcrumb } from "@repo/ds/shell";
import {
  OVERVIEW_NAV,
  CAMPAIGNS_NAV,
  PLATFORM_ADMIN_NAV,
  STRATEGY_NAV,
  TEAM_OBJECTIVES_NAV,
  TENANT_CONFIGURATION_NAV,
} from "@/data/sidebar-nav";

const NAV_ITEMS = [
  ...OVERVIEW_NAV.items,
  ...TEAM_OBJECTIVES_NAV.items,
  ...STRATEGY_NAV.items,
  ...CAMPAIGNS_NAV.items,
  ...TENANT_CONFIGURATION_NAV.items,
  ...PLATFORM_ADMIN_NAV.items,
];

const BREADCRUMB_LABELS = new Map([
  ["platform", "Platform administration"],
  ["planning", "Objective Planning"],
  ["performance", "Performance configuration"],
  ["campaigns", "Campaigns"],
  ["new", "New campaign"],
  ["team-objectives", "Team objectives"],
  ["strategy", "Strategy"],
]);

export function PerformanceAppBreadcrumb() {
  const pathname = usePathname();
  const activePath = pathname.replace(/^\/performance/, "") || "/";

  return (
    <AppBreadcrumb
      appName="Performance"
      pathname={activePath}
      navItems={NAV_ITEMS}
      overrides={BREADCRUMB_LABELS}
    />
  );
}
