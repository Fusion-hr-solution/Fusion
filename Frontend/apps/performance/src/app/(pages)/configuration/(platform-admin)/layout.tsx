"use client";

import type { ReactNode } from "react";
import { useAuth, hasAnyRole, PLATFORM_ADMIN_ROLE } from "@repo/auth";
import { PageContainer, PageLoading, PagePermissionNotice } from "@repo/ds/shell";

export default function PlatformAdminLayout({ children }: { children: ReactNode }) {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <PageContainer width="narrow">
        <PageLoading rows={4} />
      </PageContainer>
    );
  }

  if (!hasAnyRole(user, [PLATFORM_ADMIN_ROLE])) {
    return (
      <PageContainer width="narrow">
        <PagePermissionNotice
          title="Platform admin access required"
          description="This area is only accessible to platform administrators."
        />
      </PageContainer>
    );
  }

  return <>{children}</>;
}
