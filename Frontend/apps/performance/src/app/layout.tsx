import type { Metadata } from "next";
import { AppHeader } from "@repo/auth";
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
    <html lang="en">
      <body className="min-h-screen antialiased">
        <AppHeader activeApp="Performance" />
        <main>{children}</main>
      </body>
    </html>
  );
}
