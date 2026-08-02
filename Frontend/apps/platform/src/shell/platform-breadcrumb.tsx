"use client";

import { usePathname } from "next/navigation";
import { useApiQuery } from "@repo/api/query";
import { AppBreadcrumb } from "@repo/ds/shell";
import { PLATFORM_NAV } from "@/data/sidebar-nav";
import { getTenant } from "@/features/tenants/api";
import { tenantKeys } from "@/features/tenants/queries";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function PlatformBreadcrumb() {
  const pathname = usePathname();
  const activePath = pathname.replace(/^\/platform/, "") || "/";
  const tenantId = activePath.split("/").find((segment) => UUID.test(segment));

  // Subscribes to the same record the page loads, so the tenant's name replaces
  // the generic segment label as soon as it arrives. `enabled: false` keeps this
  // a read of that shared cache rather than a second request for the same data.
  const { data: tenant } = useApiQuery(
    tenantKeys.detail(tenantId ?? "none"),
    (signal) => getTenant(tenantId!, signal),
    { enabled: false }
  );

  const overrides =
    tenantId && tenant
      ? new Map([[tenantId, tenant.name]])
      : new Map<string, string>();

  return (
    <AppBreadcrumb
      appName="Platform"
      pathname={activePath}
      navItems={PLATFORM_NAV.items}
      overrides={overrides}
    />
  );
}
