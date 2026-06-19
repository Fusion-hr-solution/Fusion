"use client";

import type { ReactNode } from "react";
import { AppShell, PageLoading, TopBar } from "@repo/ds/shell";
import { Skeleton } from "@/components/ui/skeleton";
import { AppBreadcrumb } from "@/shell/app-breadcrumb";
import { CoreSidebar } from "@/shell/navigation/core-sidebar";
import {
  CoreSetupRouteGuard,
  useCoreSetupAccess,
} from "@/shell/setup-access";
import { CoreTenantBanner } from "@/shell/tenant-context/core-tenant-banner";

export function CorePagesShell({ children }: { children: ReactNode }) {
  const { isShellLoading } = useCoreSetupAccess();

  if (isShellLoading) {
    return <CoreShellLoadingState />;
  }

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

function CoreShellLoadingState() {
  return (
    <div className="flex h-screen overflow-hidden bg-muted/30">
      <aside className="dark hidden w-[264px] shrink-0 flex-col border-r border-sidebar-border bg-sidebar p-3 lg:flex">
        <div className="flex items-center gap-2.5 p-1.5">
          <Skeleton className="h-9 w-9 rounded-md" />
          <div className="space-y-1.5">
            <Skeleton className="h-3.5 w-28" />
            <Skeleton className="h-2.5 w-20" />
          </div>
        </div>
        <div className="mt-6 space-y-6">
          {Array.from({ length: 2 }).map((_, s) => (
            <div key={s} className="space-y-2">
              <Skeleton className="h-2.5 w-16" />
              {Array.from({ length: 4 }).map((__, i) => (
                <Skeleton key={i} className="h-9 w-full rounded-md" />
              ))}
            </div>
          ))}
        </div>
      </aside>
      <main className="flex-1 overflow-y-auto p-6">
        <div className="mx-auto w-full max-w-6xl space-y-6">
          <Skeleton className="h-8 w-48" />
          <div className="grid gap-4 md:grid-cols-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-28 rounded-xl" />
            ))}
          </div>
          <PageLoading rows={5} />
        </div>
      </main>
    </div>
  );
}
