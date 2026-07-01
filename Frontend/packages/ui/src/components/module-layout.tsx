"use client";

import { TopLoader } from "./top-loader";

interface ModuleLayoutProps {
  sidebar: React.ReactNode;
  children: React.ReactNode;
}

export function ModuleLayout({ sidebar, children }: ModuleLayoutProps) {
  return (
    <>
      <TopLoader />
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:rounded-md focus:border focus:border-border focus:bg-background focus:px-3 focus:py-2 focus:text-sm focus:font-medium focus:text-foreground focus:shadow-md focus:ring-2 focus:ring-ring"
      >
        Skip to main content
      </a>
      <div className="flex h-screen overflow-hidden">
        {sidebar}
        <main id="main-content" tabIndex={-1} className="flex-1 overflow-y-auto focus:outline-none">
          {children}
        </main>
      </div>
    </>
  );
}
