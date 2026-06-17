"use client";

import { Monitor, Moon, Sun, type LucideIcon } from "lucide-react";
import { cn } from "../../lib/utils";
import { useTheme } from "./theme-provider";
import type { Theme } from "./constants";

export interface ThemeToggleLabels {
  light: string;
  system: string;
  dark: string;
  /** Accessible name for the control group. */
  group: string;
}

const DEFAULT_LABELS: ThemeToggleLabels = {
  light: "Light",
  system: "System",
  dark: "Dark",
  group: "Theme",
};

const OPTIONS: { value: Theme; Icon: LucideIcon }[] = [
  { value: "light", Icon: Sun },
  { value: "system", Icon: Monitor },
  { value: "dark", Icon: Moon },
];

/**
 * Segmented Light / System / Dark control. Presentational: pass translated
 * `labels` so each module can localize it (the theme logic lives in
 * {@link ThemeProvider}). Mirrors the language switcher's pill grammar.
 */
export function ThemeToggle({
  labels,
  className,
}: {
  labels?: Partial<ThemeToggleLabels>;
  className?: string;
}) {
  const { theme, setTheme } = useTheme();
  const l = { ...DEFAULT_LABELS, ...labels };

  return (
    <div
      role="group"
      aria-label={l.group}
      className={cn(
        "inline-flex items-center gap-0.5 rounded-lg border border-border/60 bg-background p-0.5",
        className
      )}
    >
      {OPTIONS.map(({ value, Icon }) => {
        const active = theme === value;
        return (
          <button
            key={value}
            type="button"
            onClick={() => setTheme(value)}
            aria-pressed={active}
            aria-label={l[value]}
            title={l[value]}
            className={cn(
              "rounded-md p-1.5 transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-background",
              active
                ? "bg-foreground text-background"
                : "text-muted-foreground hover:bg-muted hover:text-foreground"
            )}
          >
            <Icon className="h-3.5 w-3.5" aria-hidden="true" />
          </button>
        );
      })}
    </div>
  );
}
