"use client";

import { ApiQueryProvider } from "@repo/api/query";

export function Providers({ children }: { children: React.ReactNode }) {
  return <ApiQueryProvider>{children}</ApiQueryProvider>;
}
