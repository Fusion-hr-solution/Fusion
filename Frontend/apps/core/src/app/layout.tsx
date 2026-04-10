import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { AuthProvider } from "@repo/auth";
import { CoreSidebar } from "@/components/core-sidebar";
import "./globals.css";

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
        <AuthProvider>
          <div className="flex h-screen overflow-hidden">
            <CoreSidebar />
            <main className="flex-1 overflow-y-auto">{children}</main>
          </div>
        </AuthProvider>
      </body>
    </html>
  );
}
