import type { Metadata } from "next";
import { AuthProvider } from "@repo/auth";
import { InterviewSidebar } from "@/components/interview-sidebar";
import "./globals.css";

export const metadata: Metadata = {
  title: "Test Management — Fusion",
  description: "Interview & test management microfrontend",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className="min-h-screen antialiased bg-white">
        <AuthProvider>
          <div className="flex h-screen overflow-hidden">
            <InterviewSidebar />
            <main className="flex-1 overflow-y-auto">{children}</main>
          </div>
        </AuthProvider>
      </body>
    </html>
  );
}