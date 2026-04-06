"use client";

import { useAuth } from "@repo/auth";

function getShellOrigin(): string {
  if (typeof window !== "undefined") {
    return (
      process.env.NEXT_PUBLIC_SHELL_ORIGIN || window.location.origin
    );
  }
  return process.env.NEXT_PUBLIC_SHELL_ORIGIN || "http://localhost:3000";
}

/**
 * Access gate for tenant-scoped pages.
 * Allows any authenticated user (HR Admin, Employee, etc.) — not limited to PlatformAdmin.
 * The welcome/activation page is for newly activated tenant admins.
 */
export function TenantAdminAccessGate({
  children,
}: {
  children: React.ReactNode;
}) {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="core-ui-root flex min-h-screen items-center justify-center bg-ch-surface text-ch-secondary">
        Loading…
      </div>
    );
  }

  if (!isAuthenticated) {
    const signinUrl = `${getShellOrigin()}/auth/signin`;
    return (
      <div className="core-ui-root flex min-h-screen flex-col items-center justify-center gap-4 bg-ch-surface px-6 font-chBody text-ch-on-surface">
        <h1 className="font-chHeadline text-2xl font-bold">Sign in required</h1>
        <p className="text-sm text-ch-secondary">
          Please sign in to access your organization.
        </p>
        <a
          href={signinUrl}
          className="text-sm font-semibold text-ch-primary underline"
        >
          Go to sign in
        </a>
      </div>
    );
  }

  return <>{children}</>;
}
