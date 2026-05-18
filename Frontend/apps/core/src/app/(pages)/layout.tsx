import type { ReactNode } from "react";
import { AuthProvider } from "@repo/auth";
import { CoreSetupAccessProvider } from "@/components/core-setup-access";
import { BreadcrumbOverridesProvider } from "@/components/breadcrumb-overrides";
import { TenantContextProvider } from "@/components/core-tenant-context-provider";
import { CorePagesShell } from "@/components/core-pages-shell";
import { Toaster } from "@/components/ui/sonner";

export default function PagesLayout({ children }: { children: ReactNode }) {
  return (
    <AuthProvider>
      <TenantContextProvider>
        <CoreSetupAccessProvider>
          <BreadcrumbOverridesProvider>
            <CorePagesShell>{children}</CorePagesShell>
          </BreadcrumbOverridesProvider>
        </CoreSetupAccessProvider>
      </TenantContextProvider>
      <Toaster />
    </AuthProvider>
  );
}
