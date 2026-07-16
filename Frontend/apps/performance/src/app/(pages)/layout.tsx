import type { ReactNode } from "react";
import { AuthProvider } from "@repo/auth";
import { PerformancePagesShell } from "@/shell/performance-pages-shell";
import { Toaster } from "@/components/ui/sonner";

export default function PagesLayout({ children }: { children: ReactNode }) {
  return (
    <AuthProvider>
      <PerformancePagesShell>{children}</PerformancePagesShell>
      <Toaster />
    </AuthProvider>
  );
}
