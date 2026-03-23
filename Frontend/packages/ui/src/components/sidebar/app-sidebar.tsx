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
  footer,
  userPanel,
  modules,
}: AppSidebarProps) {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <aside
      className={cn(
        "group/sidebar relative flex h-full shrink-0 flex-col border-r border-[hsl(var(--ey-grey-200))]/60 bg-white transition-[width] duration-300 ease-in-out",
        collapsed ? "w-[68px]" : "w-[260px]"
      )}
    >
      {/* Collapse toggle */}
      <button
        onClick={() => setCollapsed((c) => !c)}
        className="absolute -right-3 top-6 z-10 flex h-6 w-6 items-center justify-center rounded-full border border-[hsl(var(--ey-grey-200))]/60 bg-white text-[hsl(var(--ey-grey-400))] shadow-sm transition-all duration-200 hover:bg-[hsl(var(--ey-grey-100))] hover:text-[hsl(var(--ey-grey-500))] hover:shadow-md hover:scale-110"
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
          "flex items-center gap-2.5 border-b border-[hsl(var(--ey-grey-200))]/40 px-5 py-4",
          collapsed && "justify-center px-0"
        )}
      >
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ey-bg-dark shadow-sm">
          <BrandIcon className="h-4 w-4 ey-text-accent" aria-hidden="true" />
        </div>
        {!collapsed && (
          <div className="overflow-hidden">
            <p className="text-sm font-bold leading-none text-[hsl(var(--ey-grey-500))]">
              {brandTitle}
            </p>
            {brandSubtitle && (
              <p className="mt-0.5 text-xs text-[hsl(var(--ey-grey-400))]">
                {brandSubtitle}
              </p>
            )}
          </div>
        )}
      </div>

      {/* Module switcher */}
      <div
        className={cn(
          "shrink-0 border-b border-[hsl(var(--ey-grey-200))]/40 px-3 py-3",
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
            {i > 0 && (
              <div className="my-4 border-t border-[hsl(var(--ey-grey-200))]/40" />
            )}
            <SidebarNav
              section={section}
              activePath={activePath}
              collapsed={collapsed}
            />
          </div>
        ))}
      </nav>

      {/* Footer */}
      {footer && (
        <div
          className={cn(
            "border-t border-[hsl(var(--ey-grey-200))]/40 px-5 py-3",
            collapsed && "px-3"
          )}
        >
          {footer}
        </div>
      )}

      {/* User panel */}
      {userPanel && (
        <div
          className={cn(
            "border-t border-[hsl(var(--ey-grey-200))]/40 px-3 py-3",
            collapsed && "px-2"
          )}
        >
          {userPanel(collapsed)}
        </div>
      )}
    </aside>
  );
}
