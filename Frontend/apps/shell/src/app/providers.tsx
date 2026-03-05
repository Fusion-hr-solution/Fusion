"use client";

import { AuthProvider } from "@/hooks/use-auth";
import { AuthButtons } from "@/components";

const navItems = [
  { href: "/", label: "Home" },
  { href: "/interview", label: "Interview" },
  { href: "/core", label: "Core" },
  { href: "/learning", label: "Learning" },
  { href: "/performance", label: "Performance" },
  { href: "/recruitment", label: "Recruitment" },
  { href: "/onboarding", label: "Onboarding" },
];

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container mx-auto flex h-16 items-center px-4">
          <div className="mr-8">
            <a href="/" className="flex items-center space-x-2">
              <span className="text-xl font-bold tracking-tight">
                Frontend
              </span>
            </a>
          </div>
          <nav className="flex items-center space-x-6 text-sm font-medium">
            {navItems.map((item) => (
              <a
                key={item.href}
                href={item.href}
                className="transition-colors hover:text-foreground/80 text-foreground/60"
              >
                {item.label}
              </a>
            ))}
          </nav>
          <div className="ml-auto">
            <AuthButtons />
          </div>
        </div>
      </header>
      <main>{children}</main>
    </AuthProvider>
  );
}
