import type { Metadata } from "next";
import { Suspense } from "react";
import { NextIntlClientProvider } from "next-intl";
import { getLocale } from "next-intl/server";
import { directionOf } from "@repo/ds/i18n";
import "./globals.css";
import { PageProgressBar } from "../components/page-progress-bar";
import { Providers } from "./providers";

export const metadata: Metadata = {
  title: "Fusion",
  description: "Fusion HR",
  icons: {
    icon: "/icon.svg",
    shortcut: "/icon.svg",
  },
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // The person's language, from the NEXT_LOCALE cookie their session writes (the last language used on this browser
  // before sign-in). Every shell screen speaks it, so the page does too.
  const locale = await getLocale();
  const dir = directionOf(locale);
  return (
    // next-themes sets the appearance class on <html> before hydration (Settings › Preferences).
    <html lang={locale} dir={dir} suppressHydrationWarning>
      <body className="min-h-screen bg-background text-foreground font-sans antialiased">
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
