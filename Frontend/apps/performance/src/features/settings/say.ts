import { useLocale } from "next-intl";
import { ApiError } from "@repo/api";
import { englishSay, useSay, type Say } from "@repo/ds/lib/say";
import { englishMessages } from "@/i18n/messages";

/**
 * Performance's `settings` catalogue through @repo/ds's shared {@link Say}.
 * The sections' pure helpers (what saving does) take one, English by default, so they
 * can be tested without rendering.
 */
export type { Say };

/** The catalogue in English, for code outside a translated tree (and tests). */
export const sayInEnglish: Say = englishSay(englishMessages, "settings");

/** The catalogue in the person's language. */
export function useSettingsSay(): Say {
  return useSay("settings");
}

/**
 * A failed save in one line. The service words its refusals in English, so they read as sent in English and as the
 * section's own line in other languages.
 */
export function useSaveFailure(): (error: unknown, fallback: string) => string | null {
  const locale = useLocale();
  return (error, fallback) => {
    if (!error) return null;
    return locale === "en" && error instanceof ApiError && error.errors[0] ? error.errors[0] : fallback;
  };
}
