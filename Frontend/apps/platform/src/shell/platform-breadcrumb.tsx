"use client";

import { usePathname } from "next/navigation";
import { AppBreadcrumb } from "@repo/ds/shell";
import { PLATFORM_OVERVIEW_NAV } from "@/data/sidebar-nav";

export function PlatformBreadcrumb() {
  const pathname = usePathname();
  const activePath = pathname.replace(/^\/platform/, "") || "/";

  return (
    <AppBreadcrumb
      appName="Platform"
      pathname={activePath}
      navItems={PLATFORM_OVERVIEW_NAV.items}
    />
  );
}
