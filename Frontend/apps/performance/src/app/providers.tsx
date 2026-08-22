"use client";

import { ApiQueryProvider, SHARED_QUERY_DEFAULTS } from "@repo/api/query";
import { ThemeProvider } from "@repo/ds/shell";

// Adopt the shared volatility-appropriate baseline: revisiting a surface within
// 30s renders cached data instantly while react-query refetches behind it, and
// previous data is retained during background revalidation instead of flashing a
// skeleton. Correctness-sensitive reads still override staleTime/invalidate per
// query. This replaces the former blanket staleTime:0 that re-skeletoned on every
// visit — expressed as an opt-in shared default, so no other MFE is affected.
export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider>
      <ApiQueryProvider queryClientConfig={SHARED_QUERY_DEFAULTS}>
        {children}
      </ApiQueryProvider>
    </ThemeProvider>
  );
}
