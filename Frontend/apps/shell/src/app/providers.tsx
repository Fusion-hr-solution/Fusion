"use client";

import { usePathname } from "next/navigation";
import { AuthProvider } from "@repo/auth";
import { ShellSidebar } from "@/components/shell-sidebar";

const AUTH_PATHS = ["/auth/signin", "/auth/signup"];

export function Providers({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isAuthPage = AUTH_PATHS.some((p) => pathname.startsWith(p));

  return (
    <AuthProvider>
      {isAuthPage ? (
        <>{children}</>
      ) : (
        <div className="flex h-screen overflow-hidden">
          <ShellSidebar />
          <main className="flex-1 overflow-y-auto">{children}</main>
        </div>
      )}
    </AuthProvider>
  );
}
