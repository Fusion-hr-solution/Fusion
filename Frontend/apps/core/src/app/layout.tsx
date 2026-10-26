import type { Metadata } from "next";
import { NextIntlClientProvider } from "next-intl";
import { getLocale } from "next-intl/server";
import { directionOf } from "@repo/ds/i18n";
import { Suspense } from "react";
import "./globals.css";
import { PageProgressBar } from "../components/page-progress-bar";
import { Providers } from "./providers";

// Core theme comes solely from @repo/ds/tokens.css (oklch tokens). Do not import a
// competing HSL token sheet here — it would clobber the @repo/ds preset tokens.

export const metadata: Metadata = {
  title: "Core HR — Fusion",
  description: "Core HR platform for employee and organizational management",
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
      <body className="min-h-screen antialiased bg-background text-foreground font-sans">
        <Suspense fallback={null}>
          <PageProgressBar />
        </Suspense>
        <NextIntlClientProvider>
          <Providers dir={dir}>{children}</Providers>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
