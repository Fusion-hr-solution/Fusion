"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useMemo } from "react";
import { useAuth } from "@repo/auth";

const PLATFORM_ADMIN_ROLE = "PlatformAdmin";

export function PlatformAdminAccessGate({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, isAuthenticated, isLoading } = useAuth();
  const pathname = usePathname() || "";

  const normalized = useMemo(() => {
    return pathname.replace(/^\/core(?=\/|$)/, "") || "/";
  }, [pathname]);

  // Public invite acceptance must stay anonymous.
  if (normalized.startsWith("/invite")) {
    return <>{children}</>;
  }

  if (isLoading) {
    return (
      <div className="core-ui-root flex min-h-screen items-center justify-center bg-ch-surface text-ch-secondary">
        Loading…
      </div>
    );
  }

  if (!isAuthenticated || user?.roles?.includes(PLATFORM_ADMIN_ROLE) !== true) {
    return (
      <div className="core-ui-root flex min-h-screen flex-col items-center justify-center gap-4 bg-ch-surface px-6 font-chBody text-ch-on-surface">
        <h1 className="font-chHeadline text-2xl font-bold">Not authorized</h1>
        <p className="text-sm text-ch-secondary">
          Your account does not have Platform Admin access.
        </p>
        <Link
          href="/auth/signin"
          className="text-sm font-semibold text-ch-primary underline"
        >
          Go to sign in
        </Link>
      </div>
    );
  }

  return <>{children}</>;
}

