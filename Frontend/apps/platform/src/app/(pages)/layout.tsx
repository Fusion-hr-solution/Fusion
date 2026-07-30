import { Suspense, type ReactNode } from "react";
import { AuthProvider } from "@repo/auth";
import { PageSkeleton } from "@repo/ds/shell";
import { PlatformAccessBoundary } from "@/features/access/platform-access-boundary";
import { PlatformPagesShell } from "@/shell/platform-pages-shell";

export default function PagesLayout({ children }: { children: ReactNode }) {
  return (
    <AuthProvider>
      <PlatformPagesShell>
        <Suspense
          fallback={
            <PageSkeleton rows={3} label="Checking Platform access" />
          }
        >
          <PlatformAccessBoundary>{children}</PlatformAccessBoundary>
        </Suspense>
      </PlatformPagesShell>
    </AuthProvider>
  );
}
