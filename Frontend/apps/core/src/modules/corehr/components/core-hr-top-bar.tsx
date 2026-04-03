"use client";

import { Bell, Search, UserCircle2 } from "lucide-react";

export function CoreHrTopBar() {
  return (
    <nav className="sticky top-0 z-40 flex w-full items-center justify-between border-b border-stone-200 bg-white/80 px-6 py-3 shadow-sm backdrop-blur-xl dark:border-stone-800 dark:bg-stone-950/80">
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
            className="w-64 rounded-lg border-none bg-ch-surface-container-low py-2 pl-10 pr-4 text-sm text-ch-on-surface placeholder:text-stone-400 focus:ring-2 focus:ring-ch-primary-container"
            readOnly
            aria-label="Global search"
          />
        </div>
        <div className="flex items-center gap-4 border-l border-stone-200 pl-6 dark:border-stone-800">
          <button
            type="button"
            className="text-stone-500 transition-colors hover:text-stone-900 dark:hover:text-stone-100"
            aria-label="Notifications"
          >
            <Bell className="h-5 w-5" />
          </button>
          <button
            type="button"
            className="text-stone-500 transition-colors hover:text-stone-900 dark:hover:text-stone-100"
            aria-label="Account"
          >
            <UserCircle2 className="h-5 w-5" />
          </button>
        </div>
      </div>
    </nav>
  );
}
