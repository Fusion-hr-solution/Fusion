import type { Metadata } from "next";
import { Providers } from "./providers";
import { PerformanceSidebar } from "@/components/performance-sidebar";
import "@repo/ui/src/ey-brand.css";
import "./globals.css";

export const metadata: Metadata = {
  title: "Performance - Frontend",
  description: "Performance management and reviews microfrontend",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="min-h-screen antialiased">
        <Providers>
          <div className="flex h-screen overflow-hidden">
            <PerformanceSidebar />
            <main className="flex-1 overflow-y-auto">{children}</main>
          </div>
        </Providers>
      </body>
    </html>
  );
}
