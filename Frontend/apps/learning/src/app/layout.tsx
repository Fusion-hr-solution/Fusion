import type { Metadata } from "next";
import { AppHeader } from "@repo/auth";
import "./globals.css";

export const metadata: Metadata = {
  title: "Learning - Frontend",
  description: "Learning management microfrontend",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="min-h-screen antialiased">
        <AppHeader activeApp="Learning" />
        <main>{children}</main>
      </body>
    </html>
  );
}
