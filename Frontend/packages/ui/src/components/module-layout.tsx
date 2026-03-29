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
      <div className="flex h-screen overflow-hidden">
        {sidebar}
        <main className="flex-1 overflow-y-auto">{children}</main>
      </div>
    </>
  );
}
