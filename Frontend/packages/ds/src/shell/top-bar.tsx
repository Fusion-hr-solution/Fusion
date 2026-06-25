import type { ReactNode } from "react";
import { cn } from "../lib/utils";
import { ThemeToggle } from "./theme";
import { LanguageSwitcher } from "./language-switcher";

export interface TopBarProps {
  /** Left side — typically the module breadcrumb. Stays at the left, unchanged. */
  left?: ReactNode;
  /** Extra controls inserted before the theme/language cluster (optional). */
  children?: ReactNode;
  className?: string;
}

/**
 * Shared Core + Performance top bar: breadcrumb (left) and the theme + language controls (right).
 * Sits inside the AppShell sticky header slot.
 */
export function TopBar({ left, children, className }: TopBarProps) {
  return (
    <div className={cn("flex h-12 items-center justify-between gap-3 px-6", className)}>
      <div className="flex min-w-0 items-center">{left}</div>
      <div className="flex shrink-0 items-center gap-2">
        {children}
        <LanguageSwitcher />
        <ThemeToggle />
      </div>
    </div>
  );
}
