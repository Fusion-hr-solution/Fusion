"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth, hasAnyRole, HR_ADMIN_ROLE } from "@repo/auth";

/**
 * Wraps employee-only pages. If the current user is an admin, redirects to admin dashboard.
 * Shows children immediately for employees or while auth is loading (to avoid flash).
 */
export function AdminRedirectGuard({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuth();
  const isAdmin = hasAnyRole(user, [HR_ADMIN_ROLE]);
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && isAdmin) {
      router.replace("/admin");
    }
  }, [isLoading, isAdmin, router]);

  if (!isLoading && isAdmin) {
    return null;
  }

  return <>{children}</>;
}
