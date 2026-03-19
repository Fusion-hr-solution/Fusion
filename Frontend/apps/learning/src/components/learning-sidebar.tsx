"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import {
  GraduationCap,
  ChevronLeft,
  ChevronRight,
  BarChart3,
} from "lucide-react";
import { EMPLOYEE_NAV, ADMIN_NAV } from "@/data/sidebar-nav";
import { SidebarSection } from "./sidebar-section";
import { StatRow } from "./stat-row";

export function LearningSidebar() {
  const pathname = usePathname();
  const activePath = pathname.replace(/^\/learning/, "") || "/";
  const [collapsed, setCollapsed] = useState(false);

  return (
    <aside
      className={`group/sidebar relative flex h-full shrink-0 flex-col border-r border-border/60 bg-white transition-[width] duration-300 ease-in-out ${
        collapsed ? "w-[68px]" : "w-[252px]"
      }`}
    >
      {/* Collapse toggle */}
      <button
        onClick={() => setCollapsed((c) => !c)}
        className="absolute -right-3 top-6 z-10 flex h-6 w-6 items-center justify-center rounded-full border border-border/60 bg-white text-muted-foreground shadow-sm transition-all duration-200 hover:bg-[hsl(var(--ey-grey-100))] hover:text-foreground hover:shadow-md hover:scale-110"
        aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
      >
        {collapsed ? (
          <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
        ) : (
          <ChevronLeft className="h-3.5 w-3.5" aria-hidden="true" />
        )}
      </button>

      {/* Brand mark */}
      <div
        className={`flex items-center gap-2.5 border-b border-border/40 px-5 py-4 ${
          collapsed ? "justify-center px-0" : ""
        }`}
      >
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ey-bg-dark shadow-sm">
          <GraduationCap className="h-4 w-4 ey-text-accent" aria-hidden="true" />
        </div>
        {!collapsed && (
          <div className="overflow-hidden">
            <p className="text-sm font-bold leading-none text-foreground">
              EY Academy
            </p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Learning Platform
            </p>
          </div>
        )}
      </div>

      {/* Scrollable nav */}
      <nav className="flex-1 overflow-y-auto px-3 py-4">
        <SidebarSection
          section={EMPLOYEE_NAV}
          activePath={activePath}
          collapsed={collapsed}
        />

        <div className="my-4 border-t border-border/40" />

        <SidebarSection
          section={ADMIN_NAV}
          activePath={activePath}
          collapsed={collapsed}
        />
      </nav>

      {/* Bottom quick stats */}
      <div
        className={`border-t border-border/40 px-5 py-3 ${collapsed ? "px-3" : ""}`}
      >
        <div
          className={`rounded-xl bg-[hsl(var(--ey-yellow))]/8 p-3 transition-all ${
            collapsed ? "flex items-center justify-center p-2" : ""
          }`}
        >
          {collapsed ? (
            <BarChart3 className="h-4 w-4 text-[hsl(var(--ey-grey-500))]" aria-hidden="true" />
          ) : (
            <>
              <div className="flex items-center gap-1.5">
                <BarChart3 className="h-3 w-3 text-muted-foreground" aria-hidden="true" />
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Quick Stats
                </p>
              </div>
              <div className="mt-2.5 space-y-2">
                <StatRow label="Completed" value="12" />
                <StatRow label="In Progress" value="3" />
                <StatRow label="Certificates" value="8" />
              </div>
            </>
          )}
        </div>
      </div>
    </aside>
  );
}
