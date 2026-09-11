"use client";

import type { ReactNode } from "react";
import { AppShell, TopBar } from "@repo/ds/shell";
import { Toaster } from "@repo/ds/components/ui/sonner";
// `Toaster` is the DS's styled sonner; the `toast()` call itself comes from
// sonner directly, the same pairing the core app uses.
import { PlatformSidebar } from "@/shell/navigation/platform-sidebar";
import { PlatformBreadcrumb } from "@/shell/platform-breadcrumb";

export function PlatformPagesShell({ children }: { children: ReactNode }) {
  return (
    <AppShell
      sidebar={<PlatformSidebar />}
      header={<TopBar left={<PlatformBreadcrumb />} />}
    >
      {children}
      {/* Mounted once for the whole platform tree so a toast raised just before
          a client navigation survives onto the page it lands on. */}
      <Toaster />
    </AppShell>
  );
}
