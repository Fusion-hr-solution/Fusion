import { Suspense, type ReactNode } from "react";
import { AuthProvider } from "@repo/auth";
import { PageSkeleton } from "@repo/ds/shell";
import { CoreSetupAccessProvider } from "@/shell/setup-access";
import { BreadcrumbOverridesProvider } from "@/shell/breadcrumb-overrides";
import { CorePagesShell } from "@/shell/core-pages-shell";
import { CoreWorkspaceAccessBoundary } from "@/shell/core-workspace-access-boundary";
import { Toaster } from "@/components/ui/sonner";

export default function PagesLayout({ children }: { children: ReactNode }) {
  return (
    <AuthProvider>
      <Suspense fallback={<PageSkeleton rows={4} label="Loading Core HR" />}>
        <CoreWorkspaceAccessBoundary>
          <CoreSetupAccessProvider>
            <BreadcrumbOverridesProvider>
              <CorePagesShell>{children}</CorePagesShell>
            </BreadcrumbOverridesProvider>
          </CoreSetupAccessProvider>
        </CoreWorkspaceAccessBoundary>
      </Suspense>
      <Toaster />
    </AuthProvider>
  );
}
