"use client";

import type { ReactNode } from "react";
import { useAuth } from "@repo/auth";
import { PLATFORM_ADMIN_ROLE } from "@repo/auth";
import { hasAnyRole } from "@repo/auth";

export default function PlatformAdminLayout({ children }: { children: ReactNode }) {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-pulse text-muted-foreground text-sm">Loading…</div>
      </div>
    );
  }

  if (!hasAnyRole(user, [PLATFORM_ADMIN_ROLE])) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center space-y-2">
          <p className="text-destructive font-medium">Access denied</p>
          <p className="text-muted-foreground text-sm">
            This area requires Platform Admin privileges.
          </p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
