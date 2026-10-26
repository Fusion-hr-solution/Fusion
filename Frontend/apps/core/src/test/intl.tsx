import type { ReactElement } from "react";
import type { RenderOptions, RenderResult } from "@testing-library/react";
import { createTranslator } from "next-intl";
import { renderWithIntl } from "@repo/ds/testing";
import type { Say } from "@repo/ds/lib/say";
import dsFr from "@repo/ds/messages/fr.json";
import authFr from "@repo/auth/messages/fr.json";
import dsAr from "@repo/ds/messages/ar.json";
import authAr from "@repo/auth/messages/ar.json";
import performanceUiFr from "@repo/performance-ui/messages/fr.json";
import performanceUiAr from "@repo/performance-ui/messages/ar.json";
import { loadCoreMessages } from "@/i18n/messages";

/** Core HR's catalogue in French, as the app serves it: @repo/ds's, @repo/auth's and @repo/performance-ui's merged with its own. */
export const frenchMessages = { ...dsFr, ...authFr, ...performanceUiFr, ...(await loadCoreMessages("fr")) };

/** One namespace in French, for pure helpers that take a {@link Say}. */
export function sayInFrench(namespace: string): Say {
  const t = createTranslator({ locale: "fr", messages: frenchMessages, namespace: namespace as never });
  return (key, values) => t(key as never, values as never);
}

/** `render` in French with Core HR's catalogue. */
export function renderInFrench(ui: ReactElement, options: RenderOptions = {}): RenderResult {
  return renderWithIntl(ui, { locale: "fr", messages: frenchMessages, ...options });
}

/** Core HR's catalogue in Arabic, merged the same way. */
export const arabicMessages = { ...dsAr, ...authAr, ...performanceUiAr, ...(await loadCoreMessages("ar")) };

/** One namespace in Arabic, for pure helpers that take a {@link Say}. */
export function sayInArabic(namespace: string): Say {
  const t = createTranslator({ locale: "ar", messages: arabicMessages, namespace: namespace as never });
  return (key, values) => t(key as never, values as never);
}

/** `render` in Arabic with Core HR's catalogue. */
export function renderInArabic(ui: ReactElement, options: RenderOptions = {}): RenderResult {
  return renderWithIntl(ui, { locale: "ar", messages: arabicMessages, ...options });
}
