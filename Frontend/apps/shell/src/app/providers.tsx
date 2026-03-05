"use client";

import { AppHeader } from "@repo/auth";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <>
      <AppHeader activeApp="Home" />
      <main>{children}</main>
    </>
  );
}
