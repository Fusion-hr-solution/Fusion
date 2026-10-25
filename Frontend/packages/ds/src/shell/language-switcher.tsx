"use client";

import { useCallback, useEffect, useState } from "react";
import { cn } from "../lib/utils";

const LOCALES = ["en", "fr"] as const;
export type FusionLocale = (typeof LOCALES)[number];
const STORAGE_KEY = "fusion_locale";

/**
 * The language kept on this device (EN/FR), in localStorage and the `fusion_locale` cookie every Fusion app reads.
 * Front-only: it does not yet drive real translation.
 */
export function useFusionLocale(): [FusionLocale, (next: FusionLocale) => void, boolean] {
  const [locale, setLocale] = useState<FusionLocale>("en");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    try {
      const stored = window.localStorage.getItem(STORAGE_KEY) as FusionLocale | null;
      if (stored && LOCALES.includes(stored)) setLocale(stored);
    } catch {
      /* ignore */
    }
  }, []);

  const choose = useCallback((next: FusionLocale) => {
    setLocale(next);
    try {
      window.localStorage.setItem(STORAGE_KEY, next);
      document.cookie = `${STORAGE_KEY}=${next}; path=/; max-age=${60 * 60 * 24 * 365}; SameSite=Lax`;
    } catch {
      /* ignore */
    }
  }, []);

  return [locale, choose, mounted];
}

/** Compact EN/FR switcher. Fusion's apps choose language in Settings › Preferences; kept for other hosts. */
export function LanguageSwitcher({ className }: { className?: string }) {
  const [locale, switchTo, mounted] = useFusionLocale();

  return (
    <div
      className={cn(
        "inline-flex items-center gap-0.5 rounded-control border border-border bg-background p-0.5",
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
              "min-h-11 min-w-11 rounded-detail px-2 text-xs font-semibold uppercase tracking-wide transition-colors md:min-h-0 md:min-w-0 md:px-1.5 md:py-0.5 md:text-[10px]",
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
