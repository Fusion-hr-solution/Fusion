"use client";

import { ApiQueryProvider } from "@repo/api/query";
import { DirectionProvider } from "@repo/ds";
import type { WritingDirection } from "@repo/ds/i18n";
import { ThemeProvider } from "@repo/ds/shell";

// Stale-while-revalidate: returning to the Tenants list within 30s renders the
// cached rows immediately while react-query refetches behind them. The tenant
// detail opts out, because a recovery action is judged against it.
const queryClientConfig = {
  defaultOptions: { queries: { staleTime: 30_000 } },
};

export function Providers({ dir, children }: { dir: WritingDirection; children: React.ReactNode }) {
  return (
    <DirectionProvider dir={dir}>
      <ThemeProvider>
        <ApiQueryProvider queryClientConfig={queryClientConfig}>
          {children}
        </ApiQueryProvider>
      </ThemeProvider>
    </DirectionProvider>
  );
}
