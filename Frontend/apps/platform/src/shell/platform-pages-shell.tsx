"use client";

import type { ReactNode } from "react";
import { AppShell, TopBar } from "@repo/ds/shell";
import { PlatformSidebar } from "@/shell/navigation/platform-sidebar";
import { PlatformBreadcrumb } from "@/shell/platform-breadcrumb";

export function PlatformPagesShell({ children }: { children: ReactNode }) {
  return (
    <AppShell
      sidebar={<PlatformSidebar />}
      header={<TopBar left={<PlatformBreadcrumb />} />}
    >
      {children}
    </AppShell>
  );
}
