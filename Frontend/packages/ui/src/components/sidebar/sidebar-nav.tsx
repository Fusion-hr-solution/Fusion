"use client";

import { cn } from "../../lib/utils";
import type { NavSection } from "./types";

interface SidebarNavProps {
  section: NavSection;
  activePath: string;
  collapsed?: boolean;
  basePath?: string;
}

function isItemActive(activePath: string, itemHref: string) {
  if (itemHref === "/") {
    return activePath === "/";
  }

  return activePath === itemHref || activePath.startsWith(`${itemHref}/`);
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
        <p className="mb-2 px-2 text-xs font-bold uppercase tracking-[0.08em] text-muted-foreground/70">
          {section.title}
        </p>
      )}
      <ul className="space-y-0.5">
        {section.items.map((item) => {
          const isActive = isItemActive(activePath, item.href);
          const Icon = item.icon;
          return (
            <li key={item.href}>
              <a
                href={`${basePath}${item.href}`}
                className={cn(
                  "relative flex items-center gap-3 rounded-lg px-2.5 py-2 text-sm font-medium transition-all duration-200",
                  collapsed && "justify-center px-2",
                  isActive
                    ? "bg-foreground text-background shadow-sm"
                    : "text-muted-foreground hover:bg-accent hover:text-foreground"
                )}
                title={collapsed ? item.label : undefined}
              >
                {isActive && (
                  <span className="absolute left-0 top-1/2 h-5 w-0.75 -translate-y-1/2 rounded-r-full bg-background" />
                )}
                <Icon
                  className="h-4 w-4 shrink-0 transition-colors"
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
                            ? "bg-background text-foreground"
                            : "bg-muted text-muted-foreground"
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
