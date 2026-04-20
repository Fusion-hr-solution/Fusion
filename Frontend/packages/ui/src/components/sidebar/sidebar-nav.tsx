"use client";

import { Lock } from "lucide-react";
import { cn } from "../../lib/utils";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "../primitives/tooltip";
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
    <TooltipProvider delayDuration={150}>
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
            const itemClasses = cn(
              "relative flex items-center gap-3 rounded-lg px-2.5 py-2 text-sm font-medium transition-all duration-200",
              collapsed && "justify-center px-2",
              item.disabled
                ? "cursor-not-allowed text-muted-foreground/55"
                : isActive
                  ? "bg-foreground text-background shadow-sm"
                  : "text-muted-foreground hover:bg-accent hover:text-foreground"
            );

            const itemContent = (
              <>
                {isActive && !item.disabled ? (
                  <span className="absolute left-0 top-1/2 h-5 w-0.75 -translate-y-1/2 rounded-r-full bg-background" />
                ) : null}
                <Icon
                  className="h-4 w-4 shrink-0 transition-colors"
                  aria-hidden="true"
                />
                {collapsed && item.disabled ? (
                  <Lock className="absolute bottom-1 right-1 h-3 w-3 shrink-0" aria-hidden="true" />
                ) : null}
                {!collapsed && (
                  <>
                    <span className="flex-1">{item.label}</span>
                    {item.badge && (
                      <span
                        className={cn(
                          "flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-xs font-bold transition-colors",
                          isActive && !item.disabled
                            ? "bg-background text-foreground"
                            : "bg-muted text-muted-foreground"
                        )}
                      >
                        {item.badge}
                      </span>
                    )}
                    {item.disabled ? (
                      <Lock className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                    ) : null}
                  </>
                )}
              </>
            );

            return (
              <li key={item.href}>
                {item.disabled ? (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span
                        aria-disabled="true"
                        tabIndex={0}
                        className={itemClasses}
                        title={collapsed ? `${item.label}: ${item.disabledReason ?? "Unavailable"}` : undefined}
                      >
                        {itemContent}
                      </span>
                    </TooltipTrigger>
                    {item.disabledReason ? (
                      <TooltipContent side="right">
                        {item.disabledReason}
                      </TooltipContent>
                    ) : null}
                  </Tooltip>
                ) : (
                  <a
                    href={`${basePath}${item.href}`}
                    className={itemClasses}
                    title={collapsed ? item.label : undefined}
                  >
                    {itemContent}
                  </a>
                )}
              </li>
            );
          })}
        </ul>
      </div>
    </TooltipProvider>
  );
}
