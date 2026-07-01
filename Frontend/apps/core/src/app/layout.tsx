import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { Suspense } from "react";
import "@repo/ui/src/ey-brand.css";
import "./globals.css";
import { PageProgressBar } from "../components/page-progress-bar";
import { Providers } from "./providers";

const fontSans = Inter({ subsets: ["latin"], variable: "--font-sans" });

export const metadata: Metadata = {
  title: "Core HR — Fusion",
  description: "Core HR platform for employee and organizational management",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning className={fontSans.variable}>
      <body className="min-h-screen antialiased bg-background text-foreground">
        <Suspense fallback={null}>
          <PageProgressBar />
        </Suspense>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
