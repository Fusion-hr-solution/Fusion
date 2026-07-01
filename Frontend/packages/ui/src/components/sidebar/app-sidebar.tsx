"use client";

import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, Menu, X } from "lucide-react";
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
  style,
  moduleSwitcherContentStyle,
  moduleSwitcherTriggerStyle,
}: AppSidebarProps) {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    if (mobileOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [mobileOpen]);

  const desktopSidebar = (
    <aside
      style={style}
      className={cn(
        "group/sidebar relative hidden h-full shrink-0 flex-col border-r border-sidebar-border bg-sidebar transition-[width] duration-300 ease-in-out md:flex",
        collapsed ? "w-[68px]" : "w-[260px]"
      )}
    >
      <DesktopCollapseToggle
        collapsed={collapsed}
        onToggle={() => setCollapsed((c) => !c)}
      />
      <SidebarBody
        activeModule={activeModule}
        modules={modules}
        collapsed={collapsed}
        activePath={activePath}
        sections={sections}
        basePath={basePath}
        footer={footer}
        userPanel={userPanel}
        brandIcon={BrandIcon}
        brandTitle={brandTitle}
        brandSubtitle={brandSubtitle}
        moduleSwitcherContentStyle={moduleSwitcherContentStyle}
        moduleSwitcherTriggerStyle={moduleSwitcherTriggerStyle}
      />
    </aside>
  );

  const mobileOverlay = mobileOpen && (
    <div className="fixed inset-0 z-50 md:hidden">
      <div
        className="absolute inset-0 bg-black/50"
        onClick={() => setMobileOpen(false)}
      />
      <aside
        style={style}
        className="relative flex h-full w-[260px] flex-col border-r border-sidebar-border bg-sidebar shadow-xl"
      >
        <button
          onClick={() => setMobileOpen(false)}
          className="absolute right-3 top-3 z-20 flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground"
          aria-label="Close sidebar"
        >
          <X className="h-5 w-5" aria-hidden="true" />
        </button>
        <SidebarBody
          activeModule={activeModule}
          modules={modules}
          collapsed={false}
          activePath={activePath}
          sections={sections}
          basePath={basePath}
          footer={footer}
          userPanel={userPanel}
          brandIcon={BrandIcon}
          brandTitle={brandTitle}
          brandSubtitle={brandSubtitle}
          moduleSwitcherContentStyle={moduleSwitcherContentStyle}
          moduleSwitcherTriggerStyle={moduleSwitcherTriggerStyle}
        />
      </aside>
    </div>
  );

  return (
    <>
      {/* Mobile hamburger button — visible below md */}
      <button
        onClick={() => setMobileOpen(true)}
        className="fixed left-3 top-3 z-40 flex h-9 w-9 items-center justify-center rounded-md border bg-background text-muted-foreground shadow-sm hover:bg-accent hover:text-foreground md:hidden"
        aria-label="Open sidebar"
      >
        <Menu className="h-5 w-5" aria-hidden="true" />
      </button>

      {desktopSidebar}
      {mobileOverlay}
    </>
  );
}

function DesktopCollapseToggle({
  collapsed,
  onToggle,
}: {
  collapsed: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      onClick={onToggle}
      className="absolute -right-3 top-6 z-20 flex h-6 w-6 items-center justify-center rounded-full border border-sidebar-border bg-sidebar text-muted-foreground shadow-sm transition-all duration-200 hover:bg-accent hover:text-foreground hover:shadow-md hover:scale-110"
      aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
    >
      {collapsed ? (
        <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
      ) : (
        <ChevronLeft className="h-3.5 w-3.5" aria-hidden="true" />
      )}
    </button>
  );
}

function SidebarBody({
  activeModule,
  modules,
  collapsed,
  activePath,
  sections,
  basePath,
  footer,
  userPanel,
  brandIcon: BrandIcon,
  brandTitle,
  brandSubtitle,
  moduleSwitcherContentStyle,
  moduleSwitcherTriggerStyle,
}: AppSidebarProps & { collapsed: boolean }) {
  return (
    <>
      {/* Brand header */}
      <div
        className={cn(
          "flex items-center gap-2.5 border-b border-sidebar-border px-5 py-4",
          collapsed && "justify-center px-0"
        )}
      >
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-foreground shadow-sm dark:bg-secondary">
          <BrandIcon className="h-4 w-4 text-primary" aria-hidden="true" />
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
          contentStyle={moduleSwitcherContentStyle}
          triggerStyle={moduleSwitcherTriggerStyle}
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
    </>
  );
}
