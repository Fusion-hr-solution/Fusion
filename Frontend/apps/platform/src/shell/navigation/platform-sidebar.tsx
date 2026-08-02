"use client";

import { usePathname } from "next/navigation";
import { Shield } from "lucide-react";
import { canAccessPlatform, useAuth } from "@repo/auth";
import { ModuleSidebar, ShellUserPanel } from "@repo/ds/shell";
import { PLATFORM_NAV } from "@/data/sidebar-nav";
import { buildShellUrl } from "@/lib/shell-url";

export function PlatformSidebar() {
  const pathname = usePathname();
  const activePath = pathname.replace(/^\/platform/, "") || "/";
  const { user, logout, isLoading } = useAuth();
  const hasPlatformAccess = canAccessPlatform(user);

  return (
    <ModuleSidebar
      brandTitle="Fusion Platform"
      brandSubtitle="Administration"
      brandIcon={Shield}
      activePath={activePath}
      sections={hasPlatformAccess ? [PLATFORM_NAV] : []}
      contextLabel={hasPlatformAccess ? "Platform access" : undefined}
      pending={isLoading}
      userPanel={(collapsed) => (
        <ShellUserPanel
          collapsed={collapsed}
          pending={isLoading}
          name={user?.fullName}
          secondaryLabel={user?.roles?.[0]}
          links={[]}
          onSignOut={async () => {
            await logout();
            window.location.assign(buildShellUrl("/auth/signin"));
          }}
        />
      )}
    />
  );
}
