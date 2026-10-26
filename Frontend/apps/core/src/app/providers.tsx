"use client";

import { ApiQueryProvider } from "@repo/api/query";
import { DirectionProvider } from "@repo/ds";
import type { WritingDirection } from "@repo/ds/i18n";
import { ThemeProvider } from "@repo/ds/shell";

// Stale-while-revalidate: revisiting a page within 30s renders cached data
// instantly (no skeleton) while react-query refetches silently in place.
// Queries needing strictly-fresh reads opt out with per-query staleTime: 0.
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
