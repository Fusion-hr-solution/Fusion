"use client";

import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { useApiQuery } from "@repo/api/query";
import { AppBreadcrumb } from "@repo/ds/shell";
import { usePlatformNav } from "@/shell/navigation/use-platform-nav";
import { getTenant } from "@/features/tenants/api";
import { tenantKeys } from "@/features/tenants/queries";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function PlatformBreadcrumb() {
  const pathname = usePathname();
  const nav = usePlatformNav();
  const t = useTranslations("frame.breadcrumb");
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

  // The route's own words ("new", "access"…) in the person's language; the
  // tenant's name replaces its id once the record has loaded.
  const overrides = new Map<string, string>([
    ["new", t("new")],
    ["access", t("access")],
    ["products", t("products")],
    ["activity", t("activity")],
  ]);
  if (tenantId && tenant) overrides.set(tenantId, tenant.name);

  return (
    <AppBreadcrumb
      appName="Platform"
      pathname={activePath}
      navItems={nav.items}
      overrides={overrides}
    />
  );
}
