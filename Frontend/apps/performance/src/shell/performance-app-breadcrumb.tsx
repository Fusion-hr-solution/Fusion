"use client";

import { usePathname } from "next/navigation";
import { AppBreadcrumb } from "@repo/ds/shell";
import {
  OVERVIEW_NAV,
  PLATFORM_ADMIN_NAV,
  TENANT_CONFIGURATION_NAV,
} from "@/data/sidebar-nav";

const NAV_ITEMS = [
  ...OVERVIEW_NAV.items,
  ...TENANT_CONFIGURATION_NAV.items,
  ...PLATFORM_ADMIN_NAV.items,
];

const BREADCRUMB_LABELS = new Map([
  ["planning", "Objective Planning"],
  ["performance", "Performance configuration"],
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
