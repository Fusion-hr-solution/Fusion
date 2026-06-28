"use client";

import type { ReactNode } from "react";
import { AppShell, TopBar } from "@repo/ds/shell";
import { PerformanceSidebar } from "./navigation/performance-sidebar";
import { PerformanceAppBreadcrumb } from "./performance-app-breadcrumb";

export function PerformancePagesShell({ children }: { children: ReactNode }) {
  return (
    <AppShell
      sidebar={<PerformanceSidebar />}
      header={<TopBar left={<PerformanceAppBreadcrumb />} />}
    >
      {children}
    </AppShell>
  );
}
