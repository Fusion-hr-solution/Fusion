import { Suspense, type ReactNode } from "react";
import { AuthProvider } from "@repo/auth";
import { PageSkeleton } from "@repo/ds/shell";
import { Toaster } from "@repo/ds/components/ui/sonner";
import { PerformancePagesShell } from "@/shell/performance-pages-shell";
import { PerformanceWorkspaceAccessBoundary } from "@/shell/performance-workspace-access-boundary";

export default function PagesLayout({ children }: { children: ReactNode }) {
  return (
    <AuthProvider>
      <Suspense fallback={<PageSkeleton rows={4} label="Loading Performance" />}>
        <PerformanceWorkspaceAccessBoundary>
          <PerformancePagesShell>{children}</PerformancePagesShell>
        </PerformanceWorkspaceAccessBoundary>
      </Suspense>
      <Toaster />
    </AuthProvider>
  );
}
