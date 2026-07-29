"use client";

import type { ReactNode } from "react";
import { AppShell, TopBar } from "@repo/ds/shell";
import { PerformanceSidebar } from "@/shell/navigation/performance-sidebar";

export function PerformancePagesShell({ children }: { children: ReactNode }) {
  return (
    <AppShell sidebar={<PerformanceSidebar />} header={<TopBar />}>
      {children}
    </AppShell>
  );
}
