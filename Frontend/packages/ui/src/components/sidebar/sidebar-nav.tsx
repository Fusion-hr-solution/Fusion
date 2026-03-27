"use client";

import { cn } from "../../lib/utils";
import type { NavSection } from "./types";

interface SidebarNavProps {
  section: NavSection;
  activePath: string;
  collapsed?: boolean;
  basePath?: string;
}

export function SidebarNav({
  section,
  activePath,
  collapsed = false,
  basePath = "",
}: SidebarNavProps) {
  return (
    <div>
      {!collapsed && (
        <p className="mb-2 px-2 text-xs font-bold uppercase tracking-[0.08em] text-[hsl(var(--ey-grey-300))]/70">
          {section.title}
        </p>
      )}
      <ul className="space-y-0.5">
        {section.items.map((item) => {
          const isActive = activePath === item.href;
          const Icon = item.icon;
          return (
            <li key={item.href}>
              <a
                href={`${basePath}${item.href}`}
                className={cn(
                  "relative flex items-center gap-3 rounded-lg px-2.5 py-2 text-sm font-medium transition-all duration-200",
                  collapsed && "justify-center px-2",
                  isActive
                    ? "bg-[hsl(var(--ey-grey-500))] text-white shadow-sm"
                    : "text-[hsl(var(--ey-grey-400))] hover:bg-[hsl(var(--ey-grey-100))] hover:text-[hsl(var(--ey-grey-500))]"
                )}
                title={collapsed ? item.label : undefined}
              >
                {isActive && (
                  <span className="absolute left-0 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-r-full bg-[hsl(var(--ey-yellow))]" />
                )}
                <Icon
                  className={cn(
                    "h-4 w-4 shrink-0 transition-colors",
                    isActive && "text-[hsl(var(--ey-yellow))]"
                  )}
                  aria-hidden="true"
                />
                {!collapsed && (
                  <>
                    <span className="flex-1">{item.label}</span>
                    {item.badge && (
                      <span
                        className={cn(
                          "flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-xs font-bold transition-colors",
                          isActive
                            ? "bg-[hsl(var(--ey-yellow))] text-[hsl(var(--ey-grey-500))]"
                            : "bg-[hsl(var(--ey-grey-200))] text-[hsl(var(--ey-grey-400))]"
                        )}
                      >
                        {item.badge}
                      </span>
                    )}
                  </>
                )}
              </a>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
