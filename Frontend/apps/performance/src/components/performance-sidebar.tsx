"use client";

import { usePathname } from "next/navigation";
import {
  BarChart3,
  Bell,
  CalendarRange,
  Home,
  LayoutDashboard,
  Library,
} from "lucide-react";
import {
  FUSION_MODULES,
  ModuleSidebar,
  ShellUserPanel,
  type ShellNavSection,
} from "@repo/ds/shell";
import { useAuth, PLATFORM_ADMIN_ROLE } from "@repo/auth";

const NAV: ShellNavSection[] = [
  { items: [{ label: "Dashboard", href: "/", icon: LayoutDashboard, exact: true }] },
  {
    title: "Performance",
    items: [
      { label: "Cycles", href: "/cycles", icon: CalendarRange },
      { label: "Objective library", href: "/objectives", icon: Library },
    ],
  },
  { title: "Inbox", items: [{ label: "Notifications", href: "/notifications", icon: Bell }] },
];

export function PerformanceSidebar() {
  const pathname = usePathname();
  const { user, logout } = useAuth();
  const activePath = pathname.replace(/^\/performance/, "") || "/";

  const roleLabel = user?.roles.includes(PLATFORM_ADMIN_ROLE)
    ? "Platform admin"
    : user?.accessProfiles?.[0]?.name ?? user?.roles?.[0] ?? undefined;

  return (
    <ModuleSidebar
      brandTitle="EY Performance"
      brandSubtitle="People development"
      brandIcon={BarChart3}
      activePath={activePath}
      sections={NAV}
      modules={FUSION_MODULES}
      currentModuleKey="performance"
      userPanel={(collapsed) => (
        <ShellUserPanel
          collapsed={collapsed}
          name={user?.fullName}
          secondaryLabel={roleLabel}
          links={[{ label: "Platform home", href: "/", icon: Home }]}
          onSignOut={async () => {
            await logout();
            window.location.href = "/auth/signin";
          }}
        />
      )}
    />
  );
}
