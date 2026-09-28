"use client";

import type { ReactNode } from "react";
import { AppShell, TopBar } from "@repo/ds/shell";
import { PerformanceSidebar } from "@/shell/navigation/performance-sidebar";
import { PerformanceCycleContext } from "@/shell/performance-cycle-context";

export function PerformancePagesShell({ children }: { children: ReactNode }) {
  // The light-mode white working surface is applied via a `--background` token
  // override in globals.css (guarded to `:not(.dark)`), not a content class here.
  // The top bar carries the Cycle context; the breadcrumb (performance-breadcrumb.tsx)
  // is parked until the breadcrumb architecture is revisited.
  return (
    <AppShell sidebar={<PerformanceSidebar />} header={<TopBar left={<PerformanceCycleContext />} />}>
      {children}
    </AppShell>
  );
}
