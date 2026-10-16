"use client";

import { Home, Layers } from "lucide-react";
import { canEnterCoreHr, canEnterPerformance, getSidebarAccountLabel, useAuth } from "@repo/auth";
import { FUSION_MODULES, ModuleSidebar, ShellUserPanel, type ShellNavItem } from "@repo/ds/shell";

/** The modules the person can enter, as Fusion-level destinations (full navigations into each app). */
export function enterableModuleItems(user: Parameters<typeof canEnterCoreHr>[0]): ShellNavItem[] {
  const enterable: Record<string, boolean> = {
    core: canEnterCoreHr(user),
    performance: canEnterPerformance(user),
  };
  return FUSION_MODULES.filter((module) => enterable[module.key]).map((module) => ({
    label: module.label,
    href: module.href,
    icon: module.icon,
    shellRoute: true,
  }));
}

export function FusionSidebar() {
  const { user, logout, isLoading } = useAuth();
  const modules = enterableModuleItems(user);
  return (
    <ModuleSidebar
      brandTitle="EY Fusion"
      brandIcon={Layers}
      activePath="/"
      pending={isLoading}
      sections={[
        { items: [{ label: "Home", href: "/", icon: Home, exact: true }] },
        ...(modules.length ? [{ title: "Modules", items: modules }] : []),
      ]}
      userPanel={(collapsed) => (
        <ShellUserPanel
          collapsed={collapsed}
          pending={isLoading}
          name={user?.fullName}
          secondaryLabel={user ? getSidebarAccountLabel(user) : undefined}
          links={[]}
          onSignOut={async () => {
            await logout();
            window.location.href = "/auth/signin";
          }}
        />
      )}
    />
  );
}
