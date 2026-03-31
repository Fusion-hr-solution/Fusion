import type { Metadata } from "next";
import { AuthProvider } from "@repo/auth";
import { ModuleLayout } from "@repo/ui";
import { CoreSidebar } from "@/components/core-sidebar";
import "@repo/ui/src/ey-brand.css";
import "./globals.css";

export const metadata: Metadata = {
  title: "Core HR - Employee Management",
  description: "Core HR platform for employee directory and management",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="min-h-screen antialiased">
        <AuthProvider>
          <ModuleLayout sidebar={<CoreSidebar />}>{children}</ModuleLayout>
        </AuthProvider>
      </body>
    </html>
  );
}
