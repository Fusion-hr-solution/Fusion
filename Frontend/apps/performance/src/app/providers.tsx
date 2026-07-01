"use client";

import type { ReactNode } from "react";
import { AuthProvider } from "@repo/auth";
import { ApiQueryProvider } from "@repo/api/query";
import { ThemeProvider } from "@repo/ds/shell";

export function Providers({ children }: { children: ReactNode }) {
  return (
    <ThemeProvider>
      <AuthProvider>
        <ApiQueryProvider>{children}</ApiQueryProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}
