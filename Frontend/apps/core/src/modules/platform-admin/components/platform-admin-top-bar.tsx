"use client";

import { useAuth } from "@repo/auth";

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
        {/* TODO: Global search - hide until implemented to avoid user confusion */}
        {/* TODO: Notifications - hide until implemented */}
        <div className="flex items-center gap-4">
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
