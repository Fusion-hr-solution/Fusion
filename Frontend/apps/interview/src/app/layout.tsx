import type { Metadata } from "next";
import { AuthLayout } from "@repo/auth";
import "./globals.css";

export const metadata: Metadata = {
  title: "Interview - Frontend",
  description: "Interview management microfrontend",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="min-h-screen antialiased">
        <AuthLayout activeApp="Interview">{children}</AuthLayout>
      </body>
    </html>
  );
}
