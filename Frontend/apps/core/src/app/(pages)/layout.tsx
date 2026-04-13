import type { ReactNode } from "react";
import { AuthProvider } from "@repo/auth";
import { CoreSidebar } from "@/components/core-sidebar";
import { AppBreadcrumb } from "@/components/app-breadcrumb";
import { Toaster } from "@/components/ui/sonner";

export default function PagesLayout({ children }: { children: ReactNode }) {
  return (
    <AuthProvider>
      <div className="flex h-screen overflow-hidden">
        <CoreSidebar />
        <main className="flex-1 overflow-y-auto">
          <div className="flex flex-col min-h-full">
            <header className="sticky top-0 z-10 flex h-10 shrink-0 items-center border-b bg-background/95 px-6 backdrop-blur supports-[backdrop-filter]:bg-background/60">
              <AppBreadcrumb />
            </header>
            {children}
          </div>
        </main>
      </div>
      <Toaster />
    </AuthProvider>
  );
}
