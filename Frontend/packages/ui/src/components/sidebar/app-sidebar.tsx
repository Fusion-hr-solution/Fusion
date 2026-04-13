"use client";

import { useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "../../lib/utils";
import { ModuleSwitcher } from "./module-switcher";
import { SidebarNav } from "./sidebar-nav";
import type { AppSidebarProps } from "./types";

export function AppSidebar({
  activeModule,
  activePath,
  sections,
  brandIcon: BrandIcon,
  brandTitle,
  brandSubtitle,
  basePath,
  footer,
  userPanel,
  modules,
}: AppSidebarProps) {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <aside
      className={cn(
        "group/sidebar relative flex h-full shrink-0 flex-col border-r border-sidebar-border bg-sidebar transition-[width] duration-300 ease-in-out",
        collapsed ? "w-[68px]" : "w-[260px]"
      )}
    >
      {/* Collapse toggle */}
      <button
        onClick={() => setCollapsed((c) => !c)}
        className="absolute -right-3 top-6 z-20 flex h-6 w-6 items-center justify-center rounded-full border border-sidebar-border bg-sidebar text-muted-foreground shadow-sm transition-all duration-200 hover:bg-accent hover:text-foreground hover:shadow-md hover:scale-110"
        aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
      >
        {collapsed ? (
          <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
        ) : (
          <ChevronLeft className="h-3.5 w-3.5" aria-hidden="true" />
        )}
      </button>

      {/* Brand header */}
      <div
        className={cn(
          "flex items-center gap-2.5 border-b border-sidebar-border px-5 py-4",
          collapsed && "justify-center px-0"
        )}
      >
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-foreground shadow-sm">
          <BrandIcon className="h-4 w-4 text-background" aria-hidden="true" />
        </div>
        {!collapsed && (
          <div className="overflow-hidden">
            <p className="text-sm font-bold leading-none text-foreground">
              {brandTitle}
            </p>
            {brandSubtitle && (
              <p className="mt-0.5 text-xs text-muted-foreground">
                {brandSubtitle}
              </p>
            )}
          </div>
        )}
      </div>

      {/* Module switcher */}
      <div
        className={cn(
          "shrink-0 border-b border-sidebar-border px-3 py-3",
          collapsed && "px-2"
        )}
      >
        <ModuleSwitcher
          activeModule={activeModule}
          modules={modules}
          collapsed={collapsed}
        />
      </div>

      {/* Navigation sections */}
      <nav className="flex-1 overflow-y-auto px-3 py-4">
        {sections.map((section, i) => (
          <div key={section.title}>
            {i > 0 && <div className="my-4 border-t border-sidebar-border" />}
            <SidebarNav
              section={section}
              activePath={activePath}
              collapsed={collapsed}
              basePath={basePath}
            />
          </div>
        ))}
      </nav>

      {/* Footer */}
      {footer && (
        <div
          className={cn(
            "border-t border-sidebar-border px-5 py-3",
            collapsed && "px-3"
          )}
        >
          {footer(collapsed)}
        </div>
      )}

      {/* User panel */}
      {userPanel && (
        <div
          className={cn(
            "border-t border-sidebar-border px-3 py-3",
            collapsed && "px-2"
          )}
        >
          {userPanel(collapsed)}
        </div>
      )}
    </aside>
  );
}
