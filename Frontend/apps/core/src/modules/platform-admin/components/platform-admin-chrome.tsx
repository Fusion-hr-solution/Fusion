"use client";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { PlatformAdminSidebar } from "./platform-admin-sidebar";
import { PlatformAdminTopBar } from "./platform-admin-top-bar";

export function PlatformAdminChrome({ children }: { children: ReactNode }) {
  const pathname = usePathname() || "";
  const normalized = pathname.replace(/^\/core(?=\/|$)/, "") || "/";

  // Skip chrome for invite pages (anonymous access)
  if (normalized.startsWith("/invite")) {
    return <>{children}</>;
  }

  return (
    <div className="core-ui-root flex min-h-screen bg-ch-surface font-chBody text-ch-on-surface">
      <PlatformAdminSidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <PlatformAdminTopBar />
        <div className="flex-1 overflow-y-auto">
          <div className="core-ui-content mx-auto w-full max-w-[min(100%,1680px)] px-5 py-6 sm:px-8 sm:py-8 lg:px-10 lg:py-10">
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}
