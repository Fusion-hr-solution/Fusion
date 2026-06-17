"use server";

import { cookies } from "next/headers";
import { LOCALE_COOKIE, isLocale, type Locale } from "./config";

/**
 * Persist the active locale in the `NEXT_LOCALE` cookie (path "/", 1-year,
 * sameSite lax). Call from a client component inside a `useTransition`, then
 * `router.refresh()` so the whole tree re-renders in the chosen language.
 */
export async function setLocale(locale: Locale): Promise<void> {
  if (!isLocale(locale)) return;
  (await cookies()).set(LOCALE_COOKIE, locale, {
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
    sameSite: "lax",
  });
}
