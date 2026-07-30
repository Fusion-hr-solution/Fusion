"use client";

import { ThemeProvider } from "@repo/ds/shell";

export function Providers({ children }: { children: React.ReactNode }) {
  return <ThemeProvider>{children}</ThemeProvider>;
}
