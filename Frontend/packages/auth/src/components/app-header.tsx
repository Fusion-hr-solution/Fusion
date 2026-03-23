"use client";

import React from "react";
import { AuthProvider } from "../auth-context";
import { AuthButtons } from "./auth-buttons";

const navItems = [
  { href: "/", label: "Home" },
  { href: "/interview", label: "Interview" },
  { href: "/core", label: "Core" },
  { href: "/learning", label: "Learning" },
  { href: "/performance", label: "Performance" },
  { href: "/recruitment", label: "Recruitment" },
  { href: "/onboarding", label: "Onboarding" },
];

interface AppHeaderProps {
  /** The currently active nav item label, e.g. "Core" */
  activeApp?: string;
}

export function AppHeader({ activeApp }: AppHeaderProps) {
  return (
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
                className={`transition-colors hover:text-foreground/80 ${
                  item.label === activeApp
                    ? "text-foreground"
                    : "text-foreground/60"
                }`}
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
  );
}

interface AuthLayoutProps {
  activeApp?: string;
  children: React.ReactNode;
}

/** Wraps children with AuthProvider — use in server-component layouts */
export function AuthLayout({ children }: AuthLayoutProps) {
  return (
    <AuthProvider>
      {children}
    </AuthProvider>
  );
}
