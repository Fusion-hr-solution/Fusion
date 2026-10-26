import type { ReactElement } from "react";
import type { RenderOptions, RenderResult } from "@testing-library/react";
import { renderWithIntl as renderWithDsIntl } from "@repo/ds/testing";
import dsEn from "@repo/ds/messages/en.json";
import dsFr from "@repo/ds/messages/fr.json";
import dsAr from "@repo/ds/messages/ar.json";
import authEn from "@repo/auth/messages/en.json";
import authFr from "@repo/auth/messages/fr.json";
import authAr from "@repo/auth/messages/ar.json";
import performanceUiEn from "@repo/performance-ui/messages/en.json";
import performanceUiFr from "@repo/performance-ui/messages/fr.json";
import performanceUiAr from "@repo/performance-ui/messages/ar.json";
import en from "../../messages/en.json";
import fr from "../../messages/fr.json";
import ar from "../../messages/ar.json";

/** The shell's catalogues as the app serves them: @repo/ds's, @repo/auth's and @repo/performance-ui's merged with its own. */
export const shellMessages = { en: { ...dsEn, ...authEn, ...performanceUiEn, ...en }, fr: { ...dsFr, ...authFr, ...performanceUiFr, ...fr }, ar: { ...dsAr, ...authAr, ...performanceUiAr, ...ar } };

/** `render` with the shell's catalogue, in English unless told otherwise. */
export function renderWithIntl(
  ui: ReactElement,
  { locale = "en", ...options }: { locale?: "en" | "fr" | "ar" } & RenderOptions = {},
): RenderResult {
  return renderWithDsIntl(ui, { locale, messages: shellMessages[locale], ...options });
}
