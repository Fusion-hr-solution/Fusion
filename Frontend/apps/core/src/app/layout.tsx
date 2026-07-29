import type { Metadata } from "next";
import { Suspense } from "react";
import "./globals.css";
import { PageProgressBar } from "../components/page-progress-bar";
import { Providers } from "./providers";

// Note: @repo/ui's ey-brand.css is intentionally NOT imported here — its HSL token set
// (older preset b6GMQMg0f) would clobber the @repo/ds oklch preset tokens. Core/Perf theme
// comes solely from @repo/ds/tokens.css.

export const metadata: Metadata = {
  title: "Core HR — Fusion",
  description: "Core HR platform for employee and organizational management",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* Shared design-system fonts (IBM Plex Sans + Space Grotesk), loaded at runtime so the
            build has no font-CDN dependency. Families/fallbacks live in @repo/ds tokens. */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        {/* eslint-disable-next-line @next/next/no-page-custom-font -- App Router head link, loaded once in the root layout */}
        <link
          href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@400;500;600;700&family=Space+Grotesk:wght@500;600;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="min-h-screen antialiased bg-background text-foreground font-sans">
        <Suspense fallback={null}>
          <PageProgressBar />
        </Suspense>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
