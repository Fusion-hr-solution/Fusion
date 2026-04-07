"use client";

import { Bell, Search } from "lucide-react";
import { useAuth } from "@repo/auth";
import { coreFieldClassName } from "@/lib/core-ui-classes";
import { cn } from "@/lib/utils";

export function PlatformAdminTopBar() {
  const { user } = useAuth();
  const userInitial = user?.fullName?.charAt(0)?.toUpperCase() || "U";
  const userRole = user?.roles?.[0] || "Platform Admin";

  return (
    <nav className="sticky top-0 z-40 flex w-full items-center justify-between border-b border-stone-200 bg-white/80 px-5 py-3 shadow-sm backdrop-blur-xl sm:px-8 lg:px-10 dark:border-stone-800 dark:bg-stone-950/80">
      <div className="mr-auto flex items-center">
        <span className="font-chHeadline text-2xl font-black uppercase tracking-tighter text-ch-primary">
          Fusion
        </span>
      </div>
      <div className="flex items-center gap-6">
        <div className="relative hidden lg:block">
          <Search
            className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400"
            aria-hidden
          />
          <input
            type="search"
            placeholder="Global search..."
            readOnly
            aria-label="Global search"
            className={cn(
              coreFieldClassName,
              "w-64 cursor-default border-none bg-ch-surface-container-low py-2 pl-10 pr-4 text-ch-on-surface focus-visible:ring-offset-white dark:focus-visible:ring-offset-stone-950"
            )}
          />
        </div>
        <div className="flex items-center gap-4 border-l border-stone-200 pl-6 dark:border-stone-800">
          <button
            type="button"
            className="relative text-stone-500 transition-colors hover:text-stone-900 dark:hover:text-stone-100"
            aria-label="Notifications"
          >
            <Bell className="h-5 w-5" />
          </button>
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-stone-900 text-xs font-bold text-white dark:bg-stone-100 dark:text-stone-900">
              {userInitial}
            </div>
            <div className="hidden min-w-0 md:block">
              <p className="truncate text-sm font-medium text-stone-700 dark:text-stone-200">
                {user?.fullName || "Platform Admin"}
              </p>
              <p className="truncate text-xs text-stone-500 dark:text-stone-400">
                {userRole}
              </p>
            </div>
          </div>
        </div>
      </div>
    </nav>
  );
}
