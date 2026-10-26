import { Suspense, type ReactNode } from "react";
import { getTranslations } from "next-intl/server";
import { AuthProvider } from "@repo/auth";
import { PageSkeleton } from "@repo/ds/shell";
import { PlatformAccessBoundary } from "@/features/access/platform-access-boundary";
import { PlatformPagesShell } from "@/shell/platform-pages-shell";

export default async function PagesLayout({ children }: { children: ReactNode }) {
  const t = await getTranslations("frame");
  return (
    <AuthProvider>
      <PlatformPagesShell>
        <Suspense
          fallback={
            <PageSkeleton rows={3} label={t("checkingAccess")} />
          }
        >
          <PlatformAccessBoundary>{children}</PlatformAccessBoundary>
        </Suspense>
      </PlatformPagesShell>
    </AuthProvider>
  );
}
