"use client";

import type { ReactNode } from "react";
import { AppShell, TopBar } from "@repo/ds/shell";
import { AppBreadcrumb } from "@/shell/app-breadcrumb";
import { CoreSidebar } from "@/shell/navigation/core-sidebar";

// The frame renders unconditionally — SSR and first client paint are identical.
// Loading only ever happens inside the content area (route loading boundary);
// the sidebar covers unknown auth state with
// its own pending treatment instead of hiding the whole shell.
export function CorePagesShell({ children }: { children: ReactNode }) {
  return (
    <AppShell
      sidebar={<CoreSidebar />}
      header={<TopBar left={<AppBreadcrumb />} />}
    >
      {children}
    </AppShell>
  );
}
