"use client";

import { useCallback } from "react";
import { useLocale, useTranslations } from "next-intl";
import { ApiError } from "@repo/api";

/** An employment or employee status the server sends ("Active", "Ended") in the person's language; an unknown one as sent. */
export function useStatusWord(): (status: string) => string {
  const t = useTranslations("common.status");
  return useCallback((status: string) => (t.has(status as "Active") ? t(status as "Active") : status), [t]);
}

/**
 * What a failed request says: the server's own refusal in English, where it is written; the screen's line otherwise,
 * so a French screen never shows an English sentence the server wrote.
 */
export function useRefusal(): (caught: unknown, fallback: string) => string {
  const locale = useLocale();
  return useCallback(
    (caught: unknown, fallback: string) =>
      locale === "en" && caught instanceof ApiError && caught.message ? caught.message : fallback,
    [locale]
  );
}
