import type { Metadata } from "next";
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
        <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
          <div className="container mx-auto flex h-16 items-center px-4">
            <div className="mr-8">
              <a href="/" className="flex items-center space-x-2">
                <span className="text-xl font-bold tracking-tight">Frontend</span>
              </a>
            </div>
            <nav className="flex items-center space-x-6 text-sm font-medium">
              <a href="/" className="transition-colors hover:text-foreground/80 text-foreground/60">Home</a>
              <a href="/interview" className="transition-colors hover:text-foreground/80 text-foreground/60">Interview</a>
              <a href="/core" className="transition-colors hover:text-foreground/80 text-foreground/60">Core</a>
              <a href="/learning" className="transition-colors hover:text-foreground/80 text-foreground/60">Learning</a>
              <a href="/performance" className="transition-colors hover:text-foreground/80 text-foreground">Performance</a>
              <a href="/recruitment" className="transition-colors hover:text-foreground/80 text-foreground/60">Recruitment</a>
              <a href="/onboarding" className="transition-colors hover:text-foreground/80 text-foreground/60">Onboarding</a>
            </nav>
          </div>
        </header>
        <main>{children}</main>
      </body>
    </html>
  );
}
