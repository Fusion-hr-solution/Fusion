import type { ReactNode } from "react";
import { AuthProvider } from "@repo/auth";
import { Toaster } from "@repo/ds/components/ui/sonner";
import { PerformancePagesShell } from "@/shell/performance-pages-shell";

export default function PagesLayout({ children }: { children: ReactNode }) {
  return (
    <AuthProvider>
      <PerformancePagesShell>{children}</PerformancePagesShell>
      <Toaster />
    </AuthProvider>
  );
}
