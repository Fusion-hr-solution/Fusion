import type { ReactElement, ReactNode } from "react";
import { NextIntlClientProvider, type AbstractIntlMessages } from "next-intl";
import { render, type RenderOptions, type RenderResult } from "@testing-library/react";
import en from "../messages/en.json";

interface IntlOptions {
  locale?: string;
  /** Defaults to @repo/ds's English catalogue; apps pass theirs merged with it. */
  messages?: AbstractIntlMessages;
}

/** The provider every translated component needs, for tests. */
export function IntlTestProvider({ children, locale = "en", messages = en }: IntlOptions & { children: ReactNode }) {
  return (
    <NextIntlClientProvider locale={locale} messages={messages} timeZone="Africa/Tunis">
      {children}
    </NextIntlClientProvider>
  );
}

/** `render` inside {@link IntlTestProvider}, in English unless told otherwise. */
export function renderWithIntl(
  ui: ReactElement,
  { locale, messages, ...options }: IntlOptions & RenderOptions = {},
): RenderResult {
  return render(ui, {
    wrapper: ({ children }) => (
      <IntlTestProvider locale={locale} messages={messages}>
        {children}
      </IntlTestProvider>
    ),
    ...options,
  });
}
