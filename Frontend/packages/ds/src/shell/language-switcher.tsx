"use client";

import { useEffect, useState } from "react";
import { cn } from "../lib/utils";

const LOCALES = ["en", "fr"] as const;
type Locale = (typeof LOCALES)[number];
const STORAGE_KEY = "fusion_locale";

/**
 * Front-only language switcher (EN/FR). Persists a preference but does not yet drive real i18n
 * in Core/Performance — present for parity with the platform's other modules.
 */
export function LanguageSwitcher({ className }: { className?: string }) {
  const [locale, setLocale] = useState<Locale>("en");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    try {
      const stored = window.localStorage.getItem(STORAGE_KEY) as Locale | null;
      if (stored && LOCALES.includes(stored)) setLocale(stored);
    } catch {
      /* ignore */
    }
  }, []);

  function switchTo(next: Locale) {
    setLocale(next);
    try {
      window.localStorage.setItem(STORAGE_KEY, next);
      document.cookie = `${STORAGE_KEY}=${next}; path=/; max-age=${60 * 60 * 24 * 365}; SameSite=Lax`;
    } catch {
      /* ignore */
    }
  }

  return (
    <div
      className={cn(
        "inline-flex items-center gap-0.5 rounded-md border border-border bg-background p-0.5",
        className
      )}
      role="group"
      aria-label="Language"
    >
      {LOCALES.map((code) => {
        const active = mounted && code === locale;
        return (
          <button
            key={code}
            type="button"
            lang={code}
            onClick={() => switchTo(code)}
            aria-pressed={active}
            className={cn(
              "min-h-11 min-w-11 rounded-sm px-2 text-xs font-semibold uppercase tracking-wide transition-colors md:min-h-0 md:min-w-0 md:px-1.5 md:py-0.5 md:text-[10px]",
              active
                ? "bg-foreground text-background"
                : "text-muted-foreground hover:bg-muted hover:text-foreground"
            )}
          >
            {code}
          </button>
        );
      })}
    </div>
  );
}
