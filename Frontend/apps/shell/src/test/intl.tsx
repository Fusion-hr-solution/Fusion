import type { ReactElement } from "react";
import type { RenderOptions, RenderResult } from "@testing-library/react";
import { renderWithIntl as renderWithDsIntl } from "@repo/ds/testing";
import dsEn from "@repo/ds/messages/en.json";
import dsFr from "@repo/ds/messages/fr.json";
import authEn from "@repo/auth/messages/en.json";
import authFr from "@repo/auth/messages/fr.json";
import en from "../../messages/en.json";
import fr from "../../messages/fr.json";

/** The shell's catalogues as the app serves them: @repo/ds's and @repo/auth's merged with its own. */
export const shellMessages = { en: { ...dsEn, ...authEn, ...en }, fr: { ...dsFr, ...authFr, ...fr } };

/** `render` with the shell's catalogue, in English unless told otherwise. */
export function renderWithIntl(
  ui: ReactElement,
  { locale = "en", ...options }: { locale?: "en" | "fr" } & RenderOptions = {},
): RenderResult {
  return renderWithDsIntl(ui, { locale, messages: shellMessages[locale], ...options });
}
