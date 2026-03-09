import type { Metadata } from "next";
import { AuthLayout } from "@repo/auth";
import "./globals.css";

export const metadata: Metadata = {
  title: "Onboarding - Frontend",
  description: "Employee onboarding and orientation microfrontend",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="min-h-screen antialiased">
        <AuthLayout activeApp="Onboarding">{children}</AuthLayout>
      </body>
    </html>
  );
}
