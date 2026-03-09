import type { Metadata } from "next";
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
        {children}
      </body>
    </html>
  );
}