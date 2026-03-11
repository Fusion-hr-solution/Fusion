import type { Metadata } from "next";
import { AuthLayout } from "@repo/auth";
import { LearningSidebar } from "@/components/learning-sidebar";
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
        <AuthLayout activeApp="Learning">
          <div className="flex h-[calc(100vh-57px)]">
            <LearningSidebar />
            <div className="flex-1 overflow-y-auto">{children}</div>
          </div>
        </AuthLayout>
      </body>
    </html>
  );
}
