"use client";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { CoreHrStitchSidebar } from "./core-hr-stitch-sidebar";
import { CoreHrTopBar } from "./core-hr-top-bar";

export function CoreHrChrome({ children }: { children: ReactNode }) {
  const pathname = usePathname() || "";
  const normalized = pathname.replace(/^\/core(?=\/|$)/, "") || "/";

  if (normalized.startsWith("/corehr/invite")) {
    return <>{children}</>;
  }

  return (
    <div className="flex min-h-screen bg-ch-surface font-chBody text-ch-on-surface">
      <CoreHrStitchSidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <CoreHrTopBar />
        <div className="flex-1 overflow-y-auto">{children}</div>
      </div>
    </div>
  );
}
