"use client";

import type { ReactNode } from "react";
import { AppShell, TopBar } from "@repo/ds/shell";
import { PerformanceSidebar } from "@/shell/navigation/performance-sidebar";
import { PerformanceBreadcrumb } from "@/shell/performance-breadcrumb";

export function PerformancePagesShell({ children }: { children: ReactNode }) {
  // The light-mode white working surface is applied via a `--background` token
  // override in globals.css (guarded to `:not(.dark)`), not a content class here.
  return (
    <AppShell sidebar={<PerformanceSidebar />} header={<TopBar left={<PerformanceBreadcrumb />} />}>
      {children}
    </AppShell>
  );
}
