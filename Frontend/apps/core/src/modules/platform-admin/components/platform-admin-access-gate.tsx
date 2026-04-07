"use client";

import { usePathname, useRouter } from "next/navigation";
import { useMemo, useEffect } from "react";
import { useAuth } from "@repo/auth";

const ALLOWED_ROLES = ["PlatformAdmin", "HRAdmin"];

// Platform Admin restricted paths (HRAdmin cannot access)
const PLATFORM_ADMIN_PATHS = ["/", "/organizations", "/design-system"];

function getShellOrigin(): string {
  if (typeof window !== "undefined") {
    return (
      process.env.NEXT_PUBLIC_SHELL_ORIGIN || window.location.origin
    );
  }
  return process.env.NEXT_PUBLIC_SHELL_ORIGIN || "http://localhost:3000";
}

export function PlatformAdminAccessGate({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, isAuthenticated, isLoading } = useAuth();
  const pathname = usePathname() || "";
  const router = useRouter();

  const normalized = useMemo(() => {
    return pathname.replace(/^\/core(?=\/|$)/, "") || "/";
  }, [pathname]);

  const isPlatformAdmin = user?.roles?.includes("PlatformAdmin");
  const isHRAdmin = user?.roles?.includes("HRAdmin");

  // Public invite acceptance must stay anonymous.
  if (normalized.startsWith("/invite")) {
    return <>{children}</>;
  }

  // Welcome page for newly activated tenant admins
  if (normalized.startsWith("/welcome")) {
    return <>{children}</>;
  }

  // Redirect HRAdmin away from Platform Admin restricted areas
  useEffect(() => {
    if (!isLoading && isHRAdmin && !isPlatformAdmin) {
      const isRestrictedPath = PLATFORM_ADMIN_PATHS.some(
        p => normalized === p || normalized.startsWith(p + "/")
      );
      if (isRestrictedPath) {
        router.replace("/welcome");
      }
    }
  }, [isLoading, isHRAdmin, isPlatformAdmin, normalized, router]);

  if (isLoading) {
    return (
      <div className="core-ui-root flex min-h-screen items-center justify-center bg-ch-surface text-ch-secondary">
        Loading…
      </div>
    );
  }

  const hasAccess = user?.roles?.some((role) => ALLOWED_ROLES.includes(role));

  if (!isAuthenticated || !hasAccess) {
    const signinUrl = `${getShellOrigin()}/auth/signin`;
    
    // Role-aware messaging
    const isHRAdminAttempt = isAuthenticated && isHRAdmin && !isPlatformAdmin;
    
    return (
      <div className="core-ui-root flex min-h-screen flex-col items-center justify-center gap-4 bg-ch-surface px-6 font-chBody text-ch-on-surface">
        <h1 className="font-chHeadline text-2xl font-bold">Not authorized</h1>
        {isHRAdminAttempt ? (
          <>
            <p className="max-w-md text-center text-sm text-ch-secondary">
              You are signed in as an HR Administrator. Platform Admin areas are not accessible to your role.
            </p>
            <a
              href={`${getShellOrigin()}/core/welcome`}
              className="text-sm font-semibold text-ch-primary underline"
            >
              Go to your welcome page
            </a>
          </>
        ) : !isAuthenticated ? (
          <>
            <p className="text-sm text-ch-secondary">
              Please sign in to access this area.
            </p>
            <a
              href={signinUrl}
              className="text-sm font-semibold text-ch-primary underline"
            >
              Go to sign in
            </a>
          </>
        ) : (
          <>
            <p className="text-sm text-ch-secondary">
              Your account does not have access to this area.
            </p>
            <a
              href={signinUrl}
              className="text-sm font-semibold text-ch-primary underline"
            >
              Go to sign in
            </a>
          </>
        )}
      </div>
    );
  }

  return <>{children}</>;
}
