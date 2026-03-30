import type { Metadata } from "next";
import { AuthProvider } from "@repo/auth";
import { ModuleLayout } from "@repo/ui";
import { LearningSidebar } from "@/components/learning-sidebar";
import "@repo/ui/src/ey-brand.css";
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
        <AuthProvider>
          <ModuleLayout sidebar={<LearningSidebar />}>
            {children}
          </ModuleLayout>
        </AuthProvider>
      </body>
    </html>
  );
}
