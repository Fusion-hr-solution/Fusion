"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { CorePageLoadingState } from "@/components/core-page-loading-state";
import { buildTenantContextHref } from "@/lib/tenant-navigation";
import { useTenantContext } from "@/shell/tenant-context/core-tenant-context-provider";

export const dynamic = "force-dynamic";

export default function AccessProfilesPage() {
  const router = useRouter();
  const { tenantId, tenantSlug } = useTenantContext();
  const settingsHref = buildTenantContextHref(
    "/settings?tab=access-permissions",
    tenantId,
    tenantSlug
  );

  useEffect(() => {
    router.replace(settingsHref);
  }, [router, settingsHref]);

  return (
    <CorePageLoadingState
      title="Access profiles"
      description="Redirecting to Settings."
      message="Opening access profile settings"
      variant="redirect"
    />
  );
}
