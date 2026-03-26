import type { Metadata } from "next";
import NextTopLoader from "nextjs-toploader";
import "@repo/ui/src/ey-brand.css";
import "./globals.css";
import { Providers } from "./providers";

export const metadata: Metadata = {
  title: "Frontend - Shell",
  description: "Main container application for the Frontend microfrontend architecture",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="min-h-screen antialiased">
        <NextTopLoader color="#2d2d2d" height={3} showSpinner={false} />
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
