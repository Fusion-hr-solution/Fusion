"use client";

import type { ReactNode } from "react";
import { AppBreadcrumb } from "@/shell/app-breadcrumb";
import { CoreSidebar } from "@/shell/navigation/core-sidebar";
import {
  CoreSetupRouteGuard,
  useCoreSetupAccess,
} from "@/shell/setup-access";
import { CoreTenantBanner } from "@/shell/tenant-context/core-tenant-banner";
import { Skeleton } from "@/components/ui/skeleton";

export function CorePagesShell({ children }: { children: ReactNode }) {
  const { isShellLoading } = useCoreSetupAccess();

  if (isShellLoading) {
    return <CoreShellLoadingState />;
  }

  return (
    <div className="flex h-screen overflow-hidden">
      <CoreSidebar />
      <main className="flex-1 overflow-y-auto overscroll-y-none bg-background">
        <div className="flex min-h-full flex-col">
          <CoreTenantBanner />
          <header className="sticky top-0 z-10 flex h-10 shrink-0 items-center border-b bg-background/95 px-6 backdrop-blur supports-backdrop-filter:bg-background/60">
            <AppBreadcrumb />
          </header>
          <CoreSetupRouteGuard>{children}</CoreSetupRouteGuard>
        </div>
      </main>
    </div>
  );
}

function CoreShellLoadingState() {
  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <aside className="hidden w-72 shrink-0 border-r bg-sidebar/70 lg:flex lg:flex-col">
        <div className="border-b px-4 py-4">
          <div className="flex items-center gap-3">
            <Skeleton className="h-10 w-10 rounded-xl" />
            <div className="space-y-2">
              <Skeleton className="h-4 w-28" />
              <Skeleton className="h-3 w-20" />
            </div>
          </div>
        </div>

        <div className="flex-1 space-y-6 p-4">
          {Array.from({ length: 2 }).map((_, sectionIndex) => (
            <div key={sectionIndex} className="space-y-3">
              <Skeleton className="h-3 w-16" />
              <div className="space-y-2">
                {Array.from({ length: 4 }).map((__, itemIndex) => (
                  <Skeleton
                    key={itemIndex}
                    className="h-10 w-full rounded-xl"
                  />
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="border-t p-4">
          <Skeleton className="h-12 w-full rounded-xl" />
        </div>
      </aside>

      <main className="flex-1 overflow-hidden">
        <div className="flex h-full flex-col">
          <header className="sticky top-0 z-10 flex h-10 shrink-0 items-center border-b bg-background/95 px-6 backdrop-blur supports-backdrop-filter:bg-background/60">
            <Skeleton className="h-4 w-40" />
          </header>

          <div className="flex-1 overflow-y-auto p-6">
            <div className="space-y-6">
              <div className="space-y-2">
                <Skeleton className="h-8 w-48" />
                <Skeleton className="h-4 w-full max-w-xl" />
              </div>

              <div className="grid gap-4 xl:grid-cols-[minmax(0,1.15fr)_minmax(320px,0.85fr)]">
                <div className="space-y-4">
                  <div className="grid gap-4 md:grid-cols-3">
                    {Array.from({ length: 3 }).map((_, index) => (
                      <Skeleton key={index} className="h-32 rounded-2xl" />
                    ))}
                  </div>
                  <Skeleton className="h-80 rounded-2xl" />
                </div>

                <div className="space-y-4">
                  <Skeleton className="h-40 rounded-2xl" />
                  <Skeleton className="h-56 rounded-2xl" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
