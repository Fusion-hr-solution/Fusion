"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { LucideIcon } from "lucide-react";
import {
  Building2,
  ChevronDown,
  LayoutDashboard,
  LogOut,
  Palette,
  Settings,
  Terminal,
} from "lucide-react";
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
}: {
  href: string;
  icon: LucideIcon;
  label: string;
  active: boolean;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "flex items-center gap-3 px-4 py-3 transition-all duration-200 active:scale-[0.98]",
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

export function CoreHrStitchSidebar() {
  const path = useNormalizedPath();
  const dashActive = path === "/" || path === "";
  const orgActive = path.startsWith("/corehr/organizations");
  const designActive = path.startsWith("/corehr/design-system");
  const settingsActive = path.startsWith("/settings");

  return (
    <aside className="sticky top-0 z-50 flex h-screen w-64 shrink-0 flex-col border-r border-stone-200 bg-stone-100 py-6 dark:border-stone-800 dark:bg-stone-900">
      <div className="mb-8 px-6">
        <div className="group flex cursor-pointer items-center justify-between">
          <div className="flex flex-col">
            <span className="font-chHeadline text-xl font-bold tracking-tight text-stone-900 dark:text-stone-50">
              Core
            </span>
            <span className="font-chBody text-[10px] font-medium uppercase tracking-wider text-stone-500">
              Platform admin
            </span>
          </div>
          <ChevronDown className="h-5 w-5 text-stone-400 transition-colors group-hover:text-stone-900" />
        </div>
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
            href="/corehr/organizations"
            icon={Building2}
            label="Organizations"
            active={orgActive}
          />
          <NavItem
            href="/corehr/design-system"
            icon={Palette}
            label="Design system"
            active={designActive}
          />
          <NavItem
            href="/settings"
            icon={Settings}
            label="Settings"
            active={settingsActive}
          />
        </div>
      </nav>

      <div className="mt-auto space-y-1 px-2">
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
        <a
          href="/auth/signin"
          className="flex items-center gap-3 px-4 py-3 text-stone-500 transition-colors hover:bg-stone-200/50 hover:text-stone-700 dark:text-stone-400 dark:hover:bg-stone-800/50"
        >
          <LogOut className="h-[22px] w-[22px]" aria-hidden />
          <span className="font-chBody text-sm font-normal uppercase tracking-wider">
            Logout
          </span>
        </a>
      </div>
    </aside>
  );
}
