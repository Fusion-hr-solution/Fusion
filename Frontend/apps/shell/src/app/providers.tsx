"use client";

import { ApiQueryProvider } from "@repo/api/query";
import { AuthProvider } from "@repo/auth";
import { DirectionProvider } from "@repo/ds";
import type { WritingDirection } from "@repo/ds/i18n";

export function Providers({ dir, children }: { dir: WritingDirection; children: React.ReactNode }) {
  return (
    <DirectionProvider dir={dir}>
      <AuthProvider>
        <ApiQueryProvider>{children}</ApiQueryProvider>
      </AuthProvider>
    </DirectionProvider>
  );
}
