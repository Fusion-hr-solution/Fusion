"use client";

import type { ReactNode } from "react";
import { AppShell, TopBar } from "@repo/ds/shell";
import { AppBreadcrumb } from "@/shell/app-breadcrumb";
import { CoreSidebar } from "@/shell/navigation/core-sidebar";
import { CoreSetupRouteGuard } from "@/shell/setup-access";
import { CoreTenantBanner } from "@/shell/tenant-context/core-tenant-banner";

// The frame renders unconditionally — SSR and first client paint are identical.
// Loading only ever happens inside the content area (route loading boundary +
// CoreSetupRouteGuard hold); the sidebar covers unknown auth/setup state with
// its own pending treatment instead of hiding the whole shell.
export function CorePagesShell({ children }: { children: ReactNode }) {
  return (
    <AppShell
      sidebar={<CoreSidebar />}
      header={<TopBar left={<AppBreadcrumb />} />}
      banner={<CoreTenantBanner />}
    >
      <CoreSetupRouteGuard>{children}</CoreSetupRouteGuard>
    </AppShell>
  );
}
