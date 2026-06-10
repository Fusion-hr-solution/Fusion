import type { ReactNode } from "react";
import { AuthProvider } from "@repo/auth";
import { CoreSetupAccessProvider } from "@/shell/setup-access";
import { BreadcrumbOverridesProvider } from "@/shell/breadcrumb-overrides";
import { TenantContextProvider } from "@/shell/tenant-context/core-tenant-context-provider";
import { CorePagesShell } from "@/shell/core-pages-shell";
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
