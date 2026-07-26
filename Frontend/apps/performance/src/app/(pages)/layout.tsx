import type { ReactNode } from "react";
import { AuthProvider } from "@repo/auth";
import { PerformancePagesShell } from "@/shell/performance-pages-shell";
import { BreadcrumbLabelProvider } from "@/shell/breadcrumb-labels";
import { Toaster } from "@/components/ui/sonner";

export default function PagesLayout({ children }: { children: ReactNode }) {
  return (
    <AuthProvider>
      <BreadcrumbLabelProvider>
        <PerformancePagesShell>{children}</PerformancePagesShell>
        <Toaster />
      </BreadcrumbLabelProvider>
    </AuthProvider>
  );
}
