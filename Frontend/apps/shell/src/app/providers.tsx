"use client";

import { ApiQueryProvider } from "@repo/api/query";
import { AuthProvider } from "@repo/auth";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <ApiQueryProvider>{children}</ApiQueryProvider>
    </AuthProvider>
  );
}
