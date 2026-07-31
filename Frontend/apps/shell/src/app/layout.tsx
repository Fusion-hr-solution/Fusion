import type { Metadata } from "next";
import { TopLoader } from "@repo/ui";
import "@repo/ui/src/ey-brand.css";
import "./globals.css";
import { Providers } from "./providers";

export const metadata: Metadata = {
  title: "Frontend - Shell",
  description: "Main container application for the Frontend microfrontend architecture",
  icons: {
    icon: "/icon.svg",
    shortcut: "/icon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="min-h-screen antialiased">
        <TopLoader />
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
