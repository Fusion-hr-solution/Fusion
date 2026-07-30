"use client";

import { usePathname } from "next/navigation";
import { AppBreadcrumb as SharedAppBreadcrumb } from "@repo/ds/shell";
import { useBreadcrumbOverridesMap } from "@/shell/breadcrumb-overrides";
import { APP_NAME } from "@/config/constants";
import { PEOPLE_NAV, ADMIN_NAV } from "@/data/sidebar-nav";

const NAV_ITEMS = [...PEOPLE_NAV.items, ...ADMIN_NAV.items];

export function AppBreadcrumb() {
  const pathname = usePathname();
  const overrides = useBreadcrumbOverridesMap();

  const clean = pathname.replace(/^\/core/, "") || "/";

  return (
    <SharedAppBreadcrumb
      appName={APP_NAME}
      pathname={clean}
      navItems={NAV_ITEMS}
      overrides={overrides}
    />
  );
}
