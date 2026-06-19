"use client";

import { useEffect, useState, type ComponentProps } from "react";
import { ThemeProvider as NextThemesProvider, useTheme } from "next-themes";
import { Check, Monitor, Moon, Sun } from "lucide-react";
import { cn } from "../lib/utils";
import { Button } from "../components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "../components/ui/dropdown-menu";

/**
 * Core + Performance theme provider. Toggles a `.dark` class on <html> via next-themes,
 * driving the @repo/ds `.dark` token block. Apps must set `suppressHydrationWarning` on <html>.
 */
export function ThemeProvider(
  props: Omit<ComponentProps<typeof NextThemesProvider>, "attribute">
) {
  return (
    <NextThemesProvider
      attribute="class"
      defaultTheme="light"
      enableSystem
      disableTransitionOnChange
      {...props}
    />
  );
}

const THEME_OPTIONS = [
  { value: "light", label: "Light", icon: Sun },
  { value: "system", label: "System", icon: Monitor },
  { value: "dark", label: "Dark", icon: Moon },
] as const;

/** Light / System / Dark switcher for the top bar. */
export function ThemeToggle({ className }: { className?: string }) {
  const { theme, setTheme, resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  // Avoid hydration mismatch: render a neutral icon until mounted.
  const ActiveIcon = !mounted
    ? Sun
    : resolvedTheme === "dark"
      ? Moon
      : Sun;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label="Change theme"
          className={cn("text-muted-foreground hover:text-foreground", className)}
        >
          <ActiveIcon className="size-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-36">
        <DropdownMenuLabel>Theme</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {THEME_OPTIONS.map((option) => {
          const Icon = option.icon;
          const active = mounted && theme === option.value;
          return (
            <DropdownMenuItem
              key={option.value}
              onSelect={() => setTheme(option.value)}
              className="gap-2"
            >
              <Icon className="size-4 text-muted-foreground" />
              <span className="flex-1">{option.label}</span>
              {active ? <Check className="size-3.5" /> : null}
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
