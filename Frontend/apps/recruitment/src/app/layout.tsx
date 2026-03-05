import type { Metadata } from "next";
import { AppHeader } from "@repo/auth";
import "./globals.css";

export const metadata: Metadata = {
  title: "Recruitment - Frontend",
  description: "Recruitment pipeline and talent acquisition microfrontend",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="min-h-screen antialiased">
        <AppHeader activeApp="Recruitment" />
        <main>{children}</main>
      </body>
    </html>
  );
}
