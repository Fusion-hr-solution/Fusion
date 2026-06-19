import type { Metadata } from "next";
import { AppShell, TopBar } from "@repo/ds/shell";
import { Providers } from "./providers";
import { PerformanceSidebar } from "@/components/performance-sidebar";
import { PerformanceBreadcrumb } from "@/components/performance-breadcrumb";
import "./globals.css";

export const metadata: Metadata = {
  title: "Performance - Frontend",
  description: "Performance management and reviews microfrontend",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* Design-system fonts (IBM Plex Sans + Space Grotesk) loaded at runtime so the
            build has no font-CDN dependency. Font families/fallbacks live in @repo/ds tokens. */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        {/* eslint-disable-next-line @next/next/no-page-custom-font -- App Router head link, loaded once in the root layout */}
        <link
          href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@400;500;600;700&family=Space+Grotesk:wght@500;600;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="min-h-screen antialiased font-sans">
        <Providers>
          <AppShell
            sidebar={<PerformanceSidebar />}
            header={<TopBar left={<PerformanceBreadcrumb />} />}
          >
            {children}
          </AppShell>
        </Providers>
      </body>
    </html>
  );
}
