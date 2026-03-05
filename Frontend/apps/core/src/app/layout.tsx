import type { Metadata } from "next";
import { AuthLayout } from "@repo/auth";
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
        <AuthLayout activeApp="Core">{children}</AuthLayout>
      </body>
    </html>
  );
}
