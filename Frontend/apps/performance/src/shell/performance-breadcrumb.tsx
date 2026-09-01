"use client";

import { usePathname } from "next/navigation";
import { AppBreadcrumb } from "@repo/ds/shell";
import { PRIMARY_NAV, ADMIN_NAV } from "@/data/sidebar-nav";
import { useBreadcrumbLabel, useBreadcrumbOverridesMap } from "@/shell/breadcrumb-overrides";

// Label resolution is nav-driven: most Performance routes are flat, static segments that appear
// in the sidebar, so the shared breadcrumb reads their labels straight from here. Deep authoring
// routes add a dynamic (UUID) segment; those register a friendly label via the overrides provider.
const NAV_ITEMS = [...PRIMARY_NAV.items, ...ADMIN_NAV.items];

/**
 * Performance's binding of the shared `AppBreadcrumb`. Mirrors Core/Platform: strip the
 * module basePath so the breadcrumb sees module-relative segments, name the module root,
 * and hand it the nav plus dynamic overrides for label resolution.
 */
export function PerformanceBreadcrumb() {
  const pathname = usePathname();
  const overrides = useBreadcrumbOverridesMap();
  const activePath = pathname.replace(/^\/performance/, "") || "/";

  return (
    <AppBreadcrumb appName="Performance" pathname={activePath} navItems={NAV_ITEMS} overrides={overrides} />
  );
}

/**
 * Registers a friendly breadcrumb label for a dynamic path segment (e.g. an objective id → its
 * title) for as long as it is mounted. Render it from a route that owns such a segment.
 */
export function PerformanceBreadcrumbLabel({ segment, label }: { segment: string; label: string | undefined }) {
  useBreadcrumbLabel(segment, label);
  return null;
}
