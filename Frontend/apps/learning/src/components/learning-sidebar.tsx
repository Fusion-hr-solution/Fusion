"use client";

import { useState } from "react";
import Link from "next/link";
import {
  BookOpen,
  LayoutDashboard,
  Award,
  Trophy,
  GraduationCap,
  ChevronLeft,
  ChevronRight,
  Users,
  BarChart3,
  ClipboardList,
  Settings,
  type LucideIcon,
} from "lucide-react";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface NavItem {
  label: string;
  href: string;
  icon: LucideIcon;
  badge?: string;
}

interface NavSection {
  title: string;
  items: NavItem[];
}

/* ------------------------------------------------------------------ */
/*  Navigation data                                                    */
/* ------------------------------------------------------------------ */

const EMPLOYEE_NAV: NavSection = {
  title: "Learning",
  items: [
    { label: "Catalog", href: "/", icon: BookOpen },
    { label: "My Trainings", href: "/my-trainings", icon: GraduationCap, badge: "3" },
    { label: "Certificates", href: "/certificates", icon: Award },
    { label: "Badges", href: "/badges", icon: Trophy },
  ],
};

const ADMIN_NAV: NavSection = {
  title: "Administration",
  items: [
    { label: "Dashboard", href: "/admin", icon: LayoutDashboard },
    { label: "Manage Trainings", href: "/admin/trainings", icon: ClipboardList },
    { label: "Employee Progress", href: "/admin/progress", icon: BarChart3 },
    { label: "Assignments", href: "/admin/assignments", icon: Users },
    { label: "Settings", href: "/admin/settings", icon: Settings },
  ],
};

/* ------------------------------------------------------------------ */
/*  Sidebar component                                                  */
/* ------------------------------------------------------------------ */

interface LearningSidebarProps {
  activePath?: string;
}

export function LearningSidebar({ activePath = "/" }: LearningSidebarProps) {
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
        className="absolute -right-3 top-6 z-10 flex h-6 w-6 items-center justify-center rounded-full border border-border/60 bg-white text-muted-foreground shadow-sm transition-colors hover:bg-[hsl(var(--ey-grey-100))] hover:text-foreground"
        aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
      >
        {collapsed ? (
          <ChevronRight className="h-3.5 w-3.5" />
        ) : (
          <ChevronLeft className="h-3.5 w-3.5" />
        )}
      </button>

      {/* Brand mark */}
      <div className={`flex items-center gap-2.5 border-b border-border/40 px-5 py-4 ${collapsed ? "justify-center px-0" : ""}`}>
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#2E2E38]">
          <GraduationCap className="h-4 w-4 text-[#FFE600]" />
        </div>
        {!collapsed && (
          <div className="overflow-hidden">
            <p className="text-[13px] font-bold leading-none text-foreground">
              EY Academy
            </p>
            <p className="mt-0.5 text-[11px] text-muted-foreground">
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

        {/* Divider */}
        <div className="my-4 border-t border-border/40" />

        <SidebarSection
          section={ADMIN_NAV}
          activePath={activePath}
          collapsed={collapsed}
        />
      </nav>

      {/* Bottom decoration */}
      <div className={`border-t border-border/40 px-5 py-3 ${collapsed ? "px-3" : ""}`}>
        <div
          className={`rounded-md bg-[#FFE600]/8 p-3 ${collapsed ? "flex items-center justify-center p-2" : ""}`}
        >
          {collapsed ? (
            <BarChart3 className="h-4 w-4 text-[#2E2E38]" />
          ) : (
            <>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                Quick Stats
              </p>
              <div className="mt-2 space-y-1.5">
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

/* ------------------------------------------------------------------ */
/*  Sub-components                                                     */
/* ------------------------------------------------------------------ */

function SidebarSection({
  section,
  activePath,
  collapsed,
}: {
  section: NavSection;
  activePath: string;
  collapsed: boolean;
}) {
  return (
    <div>
      {!collapsed && (
        <p className="mb-2 px-2 text-[10px] font-bold uppercase tracking-[0.08em] text-muted-foreground/70">
          {section.title}
        </p>
      )}
      <ul className="space-y-0.5">
        {section.items.map((item) => {
          const isActive = activePath === item.href;
          const Icon = item.icon;
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                className={`relative flex items-center gap-3 rounded-md px-2.5 py-2 text-[13px] font-medium transition-colors ${
                  collapsed ? "justify-center px-2" : ""
                } ${
                  isActive
                    ? "bg-[#2E2E38] text-white"
                    : "text-muted-foreground hover:bg-[hsl(var(--ey-grey-100))] hover:text-foreground"
                }`}
                title={collapsed ? item.label : undefined}
              >
                {/* Active indicator */}
                {isActive && (
                  <span className="absolute left-0 top-1/2 h-4 w-[3px] -translate-y-1/2 rounded-r-full bg-[#FFE600]" />
                )}
                <Icon className="h-4 w-4 shrink-0" />
                {!collapsed && (
                  <>
                    <span className="flex-1">{item.label}</span>
                    {item.badge && (
                      <span
                        className={`flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-[10px] font-bold ${
                          isActive
                            ? "bg-[#FFE600] text-[#2E2E38]"
                            : "bg-[hsl(var(--ey-grey-200))] text-muted-foreground"
                        }`}
                      >
                        {item.badge}
                      </span>
                    )}
                  </>
                )}
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function StatRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-[11px] text-muted-foreground">{label}</span>
      <span className="text-[12px] font-semibold text-foreground">{value}</span>
    </div>
  );
}
