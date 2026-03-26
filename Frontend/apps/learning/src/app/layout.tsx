import type { Metadata } from "next";
import NextTopLoader from "nextjs-toploader";
import { AuthProvider } from "@repo/auth";
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
        <NextTopLoader color="hsl(var(--ey-grey-800))" height={2} showSpinner={false} />
        <AuthProvider>
          <div className="flex h-screen overflow-hidden">
            <LearningSidebar />
            <main className="flex-1 overflow-y-auto">{children}</main>
          </div>
        </AuthProvider>
      </body>
    </html>
  );
}
