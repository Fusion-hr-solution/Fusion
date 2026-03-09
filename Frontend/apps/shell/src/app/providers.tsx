"use client";

import { AuthLayout } from "@repo/auth";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <AuthLayout activeApp="Home">{children}</AuthLayout>
  );
}
