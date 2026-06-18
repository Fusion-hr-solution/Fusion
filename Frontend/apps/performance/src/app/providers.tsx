"use client";

import type { ReactNode } from "react";
import { AuthProvider } from "@repo/auth";
import { ApiQueryProvider } from "@repo/api/query";

export function Providers({ children }: { children: ReactNode }) {
  return (
    <AuthProvider>
      <ApiQueryProvider>{children}</ApiQueryProvider>
    </AuthProvider>
  );
}
