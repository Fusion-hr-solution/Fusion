"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { LucideIcon } from "lucide-react";
import {
  Building2,
  ChevronLeft,
  ChevronRight,
  LayoutDashboard,
  LogOut,
  Palette,
  Settings,
  Terminal,
  Users,
} from "lucide-react";
import { useAuth } from "@repo/auth";
import { ModuleSwitcher } from "@repo/ui";
import { PLATFORM_MODULES } from "@/config/platform-modules";
import { cn } from "@/lib/utils";

function useNormalizedPath() {
  const pathname = usePathname() || "";
  return pathname.replace(/^\/core(?=\/|$)/, "") || "/";
}

function NavItem({
  href,
  icon: Icon,
  label,
  active,
  disabled = false,
  collapsed = false,
}: {
  href: string;
  icon: LucideIcon;
  label: string;
  active: boolean;
  disabled?: boolean;
  collapsed?: boolean;
}) {
  const baseStyles =
    "flex items-center gap-3 px-4 py-3 transition-all duration-200";

  if (disabled) {
    return (
      <span
        className={cn(
          baseStyles,
          collapsed && "justify-center px-2",
          "cursor-not-allowed text-stone-400 opacity-50 dark:text-stone-600"
        )}
        title={collapsed ? label : "Coming soon"}
      >
        <Icon className="h-[22px] w-[22px] shrink-0" aria-hidden />
        {!collapsed && <span className="font-chBody text-sm">{label}</span>}
      </span>
    );
  }

  return (
    <Link
      href={href}
      title={collapsed ? label : undefined}
      className={cn(
        baseStyles,
        collapsed && "justify-center px-2",
        "active:scale-[0.98]",
        active
          ? "border-l-4 border-yellow-400 bg-stone-50 font-semibold text-stone-900 dark:bg-stone-800 dark:text-stone-50"
          : "text-stone-500 hover:bg-stone-200/50 hover:text-stone-700 dark:text-stone-400 dark:hover:bg-stone-800/50"
      )}
    >
      <Icon className="h-[22px] w-[22px] shrink-0" aria-hidden />
      {!collapsed && <span className="font-chBody text-sm">{label}</span>}
    </Link>
  );
}

export function PlatformAdminSidebar() {
  const [collapsed, setCollapsed] = useState(false);
  const path = useNormalizedPath();
  const { user, logout } = useAuth();
  const dashActive = path === "/" || path === "";
  const employeesActive = path.startsWith("/employees");
  const orgActive = path.startsWith("/organizations");
  const designActive = path.startsWith("/design-system");
  const settingsActive = path.startsWith("/settings");

  const isPlatformAdmin = user?.roles?.includes("PlatformAdmin");
  const isHRAdmin = user?.roles?.includes("HRAdmin");

  const handleLogout = async () => {
    await logout();
    const shellOrigin =
      process.env.NEXT_PUBLIC_SHELL_ORIGIN || window.location.origin;
    window.location.href = `${shellOrigin}/auth/signin`;
  };

  const userInitial = user?.fullName?.charAt(0)?.toUpperCase() || "U";
  const userRole = user?.roles?.[0] || "Platform Admin";

  return (
    <aside
      className={cn(
        "sticky top-0 z-50 flex h-screen shrink-0 flex-col border-r border-stone-200 bg-stone-100 py-6 transition-[width] duration-300 ease-in-out dark:border-stone-800 dark:bg-stone-900",
        collapsed ? "w-[68px]" : "w-64"
      )}
    >
      {/* Collapse toggle */}
      <button
        onClick={() => setCollapsed((c) => !c)}
        className="absolute -right-3 top-6 z-10 flex h-6 w-6 items-center justify-center rounded-full border border-stone-200 bg-stone-100 text-stone-500 shadow-sm transition-all duration-200 hover:bg-stone-200 hover:text-stone-700 hover:shadow-md dark:border-stone-700 dark:bg-stone-800 dark:hover:bg-stone-700"
        aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
      >
        {collapsed ? (
          <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
        ) : (
          <ChevronLeft className="h-3.5 w-3.5" aria-hidden="true" />
        )}
      </button>

      <div className={cn("mb-6 space-y-2", collapsed ? "px-2" : "px-3")}>
        {!collapsed && (
          <div className="core-module-switcher">
            <ModuleSwitcher
              activeModule="Core"
              modules={PLATFORM_MODULES}
              variant="stitch"
            />
          </div>
        )}
        {!collapsed && (
          <p className="px-1 text-center font-chBody text-[10px] font-medium uppercase tracking-wider text-stone-500">
            {isPlatformAdmin ? "Platform admin" : "HR Admin"}
          </p>
        )}
        {collapsed && (
          <div className="flex h-10 w-full items-center justify-center">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-stone-900 text-xs font-bold text-white dark:bg-stone-100 dark:text-stone-900">
              C
            </div>
          </div>
        )}
      </div>

      <nav className="flex flex-1 flex-col space-y-1">
        <div className="px-2">
          <NavItem
            href="/"
            icon={LayoutDashboard}
            label="Dashboard"
            active={dashActive}
            collapsed={collapsed}
            disabled={!isPlatformAdmin}
          />
          <NavItem
            href="/employees"
            icon={Users}
            label="Employees"
            active={employeesActive}
            collapsed={collapsed}
          />
          <NavItem
            href="/organizations"
            icon={Building2}
            label="Organizations"
            active={orgActive}
            collapsed={collapsed}
            disabled={!isPlatformAdmin}
          />
          <NavItem
            href="/settings"
            icon={Settings}
            label="Settings"
            active={settingsActive}
            disabled
            collapsed={collapsed}
          />
        </div>
      </nav>

      <div className="mt-auto space-y-1 px-2">
        <NavItem
          href="/design-system"
          icon={Palette}
          label="Design System"
          active={designActive}
          collapsed={collapsed}
          disabled={!isPlatformAdmin}
        />
        <button
          type="button"
          className={cn(
            "flex w-full items-center gap-3 px-4 py-3 text-stone-500 transition-colors hover:bg-stone-200/50 hover:text-stone-700 dark:text-stone-400 dark:hover:bg-stone-800/50",
            collapsed && "justify-center px-2"
          )}
          title={collapsed ? "Logs" : undefined}
          onClick={(e) => e.preventDefault()}
        >
          <Terminal className="h-[22px] w-[22px] shrink-0" aria-hidden />
          {!collapsed && (
            <span className="font-chBody text-sm">Logs</span>
          )}
        </button>

        {/* User panel */}
        <div
          className={cn(
            "mt-4 border-t border-stone-200 pt-4 dark:border-stone-700",
            collapsed ? "px-0" : "px-2"
          )}
        >
          {collapsed ? (
            <div className="flex flex-col items-center gap-2">
              <div
                className="flex h-8 w-8 items-center justify-center rounded-full bg-stone-900 text-xs font-bold text-white dark:bg-stone-100 dark:text-stone-900"
                title={user?.fullName || "User"}
              >
                {userInitial}
              </div>
              <button
                type="button"
                onClick={handleLogout}
                className="flex h-7 w-7 items-center justify-center rounded-md text-stone-500 transition-colors hover:bg-stone-200/50 hover:text-stone-700 dark:text-stone-400 dark:hover:bg-stone-800/50"
                title="Sign out"
                aria-label="Sign out"
              >
                <LogOut className="h-4 w-4" />
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-stone-900 text-sm font-bold text-white dark:bg-stone-100 dark:text-stone-900">
                {userInitial}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-stone-700 dark:text-stone-200">
                  {user?.fullName || "Platform Admin"}
                </p>
                <p className="truncate text-xs text-stone-500 dark:text-stone-400">
                  {userRole}
                </p>
              </div>
              <button
                type="button"
                onClick={handleLogout}
                className="shrink-0 rounded-md p-1.5 text-stone-500 transition-colors hover:bg-stone-200/50 hover:text-stone-700 dark:text-stone-400 dark:hover:bg-stone-800/50"
                title="Sign out"
                aria-label="Sign out"
              >
                <LogOut className="h-4 w-4" />
              </button>
            </div>
          )}
        </div>
      </div>
    </aside>
  );
}
