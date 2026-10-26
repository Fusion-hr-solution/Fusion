import type { Metadata } from "next";
import { NextIntlClientProvider } from "next-intl";
import { getLocale } from "next-intl/server";
import { directionOf } from "@repo/ds/i18n";
import { Providers } from "./providers";
import "./globals.css";

export const metadata: Metadata = {
  title: "Performance — Fusion",
  description: "Performance workspace",
};

export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  // The person's language, from the NEXT_LOCALE cookie their session writes. `lang` stays English while most of the
  // text is; translated regions set their own.
  const locale = await getLocale();
  const dir = directionOf(locale);
  return (
    <html lang="en" dir={dir} suppressHydrationWarning>
      <body className="min-h-screen bg-background font-sans text-foreground antialiased">
        <NextIntlClientProvider>
          <Providers dir={dir}>{children}</Providers>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
