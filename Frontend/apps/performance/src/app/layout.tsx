import type { Metadata } from "next";
import { Providers } from "./providers";
import "./globals.css";

// Note: @repo/ui's ey-brand.css is intentionally NOT imported here — its HSL token set
// (older preset b6GMQMg0f) would clobber the @repo/ds oklch preset tokens. Core/Perf theme
// comes solely from @repo/ds/tokens.css.

export const metadata: Metadata = {
  title: "Performance — Fusion",
  description: "Performance management and reviews microfrontend",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        {/* eslint-disable-next-line @next/next/no-page-custom-font -- App Router head link, loaded once in the root layout */}
        <link
          href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@400;500;600;700&family=Space+Grotesk:wght@500;600;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="min-h-screen antialiased bg-background text-foreground font-sans" suppressHydrationWarning>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
