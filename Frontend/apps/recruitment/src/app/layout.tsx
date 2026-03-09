import type { Metadata } from "next";
import { AuthLayout } from "@repo/auth";
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
        <AuthLayout activeApp="Recruitment">{children}</AuthLayout>
      </body>
    </html>
  );
}
