"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import type { LucideIcon } from "lucide-react";
import {
  Building2,
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
}: {
  href: string;
  icon: LucideIcon;
  label: string;
  active: boolean;
  disabled?: boolean;
}) {
  const baseStyles =
    "flex items-center gap-3 px-4 py-3 transition-all duration-200";

  if (disabled) {
    return (
      <span
        className={cn(
          baseStyles,
          "cursor-not-allowed text-stone-400 opacity-50 dark:text-stone-600"
        )}
        title="Coming soon"
      >
        <Icon className="h-[22px] w-[22px] shrink-0" aria-hidden />
        <span className="font-chBody text-sm">{label}</span>
      </span>
    );
  }

  return (
    <Link
      href={href}
      className={cn(
        baseStyles,
        "active:scale-[0.98]",
        active
          ? "border-l-4 border-yellow-400 bg-stone-50 font-semibold text-stone-900 dark:bg-stone-800 dark:text-stone-50"
          : "text-stone-500 hover:bg-stone-200/50 hover:text-stone-700 dark:text-stone-400 dark:hover:bg-stone-800/50"
      )}
    >
      <Icon className="h-[22px] w-[22px] shrink-0" aria-hidden />
      <span className="font-chBody text-sm">{label}</span>
    </Link>
  );
}

export function PlatformAdminSidebar() {
  const path = useNormalizedPath();
  const router = useRouter();
  const { logout } = useAuth();
  const dashActive = path === "/" || path === "";
  const employeesActive = path.startsWith("/employees");
  const orgActive = path.startsWith("/organizations");
  const designActive = path.startsWith("/design-system");
  const settingsActive = path.startsWith("/settings");

  const handleLogout = async () => {
    await logout();
    router.push("/auth/signin");
  };

  return (
    <aside className="sticky top-0 z-50 flex h-screen w-64 shrink-0 flex-col border-r border-stone-200 bg-stone-100 py-6 dark:border-stone-800 dark:bg-stone-900">
      <div className="mb-6 space-y-2 px-3">
        <div className="core-module-switcher">
          <ModuleSwitcher
            activeModule="Core"
            modules={PLATFORM_MODULES}
            variant="stitch"
          />
        </div>
        <p className="px-1 text-center font-chBody text-[10px] font-medium uppercase tracking-wider text-stone-500">
          Platform admin
        </p>
      </div>

      <nav className="flex flex-1 flex-col space-y-1">
        <div className="px-2">
          <NavItem
            href="/"
            icon={LayoutDashboard}
            label="Dashboard"
            active={dashActive}
          />
          <NavItem
            href="/employees"
            icon={Users}
            label="Employees"
            active={employeesActive}
          />
          <NavItem
            href="/organizations"
            icon={Building2}
            label="Organizations"
            active={orgActive}
          />
          <NavItem
            href="/settings"
            icon={Settings}
            label="Settings"
            active={settingsActive}
            disabled
          />
        </div>
      </nav>

      <div className="mt-auto space-y-1 px-2">
        <NavItem
          href="/design-system"
          icon={Palette}
          label="Design system"
          active={designActive}
        />
        <a
          href="#"
          className="flex items-center gap-3 px-4 py-3 text-stone-500 transition-colors hover:bg-stone-200/50 hover:text-stone-700 dark:text-stone-400 dark:hover:bg-stone-800/50"
          onClick={(e) => e.preventDefault()}
        >
          <Terminal className="h-[22px] w-[22px]" aria-hidden />
          <span className="font-chBody text-sm font-normal uppercase tracking-wider">
            Logs
          </span>
        </a>
        <button
          type="button"
          onClick={handleLogout}
          className="flex w-full items-center gap-3 px-4 py-3 text-stone-500 transition-colors hover:bg-stone-200/50 hover:text-stone-700 dark:text-stone-400 dark:hover:bg-stone-800/50"
        >
          <LogOut className="h-[22px] w-[22px]" aria-hidden />
          <span className="font-chBody text-sm font-normal uppercase tracking-wider">
            Logout
          </span>
        </button>
      </div>
    </aside>
  );
}
