"use client";

import type { ReactNode } from "react";
import { AppShell, TopBar } from "@repo/ds/shell";
import { PerformanceSidebar } from "./navigation/performance-sidebar";
import { PerformanceAppBreadcrumb } from "./performance-app-breadcrumb";
import { NotificationBell } from "./notifications/notification-bell";

export function PerformancePagesShell({ children }: { children: ReactNode }) {
  return (
    <AppShell
      sidebar={<PerformanceSidebar />}
      header={
        <TopBar left={<PerformanceAppBreadcrumb />}>
          <NotificationBell />
        </TopBar>
      }
    >
      {children}
    </AppShell>
  );
}
