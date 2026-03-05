import type { Metadata } from "next";
import { AppHeader } from "@repo/auth";
import "./globals.css";

export const metadata: Metadata = {
  title: "Core - Frontend",
  description: "Core platform microfrontend",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="min-h-screen antialiased">
        <AppHeader activeApp="Core" />
        <main>{children}</main>
      </body>
    </html>
  );
}
