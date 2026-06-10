import type { Metadata } from "next";
import { AuthProvider } from "@repo/auth";
import { AppShell } from "@/components/app-shell";
import { Providers } from "@/app/providers";
import "@repo/ui/src/ey-brand.css";
import "./globals.css";

export const metadata: Metadata = {
  title: "Test Management — Fusion",
  description: "Interview & test management microfrontend",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className="min-h-screen antialiased bg-white">
        <Providers>
          <AuthProvider>
            <AppShell>{children}</AppShell>
          </AuthProvider>
        </Providers>
      </body>
    </html>
  );
}