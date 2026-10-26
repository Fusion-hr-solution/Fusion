"use client";

import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import { DEFAULT_LOCALE, isLocale, type Locale } from "@repo/i18n/config";
import { persistLanguageCookie } from "@repo/api";
import { useAuth } from "./auth-context";
import { loadAuth, persistAuth, saveLanguage } from "./auth-service";

/**
 * The signed-in person's language, kept on their account.
 *
 * `setLanguage` saves it to the account first. Only once that succeeds does it update the stored session and the
 * `NEXT_LOCALE` cookie and re-render the server tree; a failed save changes nothing and throws for the caller to show.
 */
export function useLanguage(): [Locale, (next: Locale) => Promise<void>, boolean] {
  const { user } = useAuth();
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const language = isLocale(user?.language) ? user.language : DEFAULT_LOCALE;

  const setLanguage = useCallback(
    async (next: Locale) => {
      setSaving(true);
      try {
        const saved = await saveLanguage(next);
        const stored = loadAuth();
        if (stored) {
          persistAuth({ ...stored, user: { ...stored.user, language: saved } });
        } else {
          persistLanguageCookie(saved);
        }
        router.refresh();
      } finally {
        setSaving(false);
      }
    },
    [router],
  );

  return [language, setLanguage, saving];
}
