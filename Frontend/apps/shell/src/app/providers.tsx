"use client";

import { AuthProvider } from "@repo/auth";
import { ShellSidebar } from "@/components/shell-sidebar";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <div className="flex h-screen overflow-hidden">
        <ShellSidebar />
        <main className="flex-1 overflow-y-auto">{children}</main>
      </div>
    </AuthProvider>
  );
}
