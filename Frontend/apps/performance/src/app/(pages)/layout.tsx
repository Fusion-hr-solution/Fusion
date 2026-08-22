import { Suspense, type ReactNode } from "react";
import { AuthProvider } from "@repo/auth";
import { PageSkeleton } from "@repo/ds/shell";
import { Toaster } from "@repo/ds/components/ui/sonner";
import { PerformancePagesShell } from "@/shell/performance-pages-shell";
import { PerformanceWorkspaceAccessBoundary } from "@/shell/performance-workspace-access-boundary";

// The module frame (sidebar, top bar) renders unconditionally and stays present
// while the session restores. Auth/access resolution and route data loading are
// confined to the content region: the access boundary gates only `children`, and
// its pending/forbidden states render inside the persistent frame rather than
// replacing the whole workspace with a skeleton.
export default function PagesLayout({ children }: { children: ReactNode }) {
  return (
    <AuthProvider>
      <PerformancePagesShell>
        <Suspense fallback={<PageSkeleton rows={4} label="Loading Performance" />}>
          <PerformanceWorkspaceAccessBoundary>
            {children}
          </PerformanceWorkspaceAccessBoundary>
        </Suspense>
      </PerformancePagesShell>
      <Toaster />
    </AuthProvider>
  );
}
