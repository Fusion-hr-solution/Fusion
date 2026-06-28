"use client";

import { ApiQueryProvider } from "@repo/api/query";
import { ThemeProvider } from "@repo/ds/shell";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider>
      <ApiQueryProvider>{children}</ApiQueryProvider>
    </ThemeProvider>
  );
}
