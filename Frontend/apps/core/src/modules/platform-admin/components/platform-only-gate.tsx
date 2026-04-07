"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@repo/auth";

function getShellOrigin(): string {
  if (typeof window !== "undefined") {
    return process.env.NEXT_PUBLIC_SHELL_ORIGIN || window.location.origin;
  }
  return process.env.NEXT_PUBLIC_SHELL_ORIGIN || "http://localhost:3000";
}

export function PlatformOnlyGate({ children }: { children: React.ReactNode }) {
  const { user, isAuthenticated, isLoading } = useAuth();
  const router = useRouter();

  const isPlatformAdmin = user?.roles?.includes("PlatformAdmin");
  const isHRAdmin = user?.roles?.includes("HRAdmin");

  useEffect(() => {
    if (!isLoading && isHRAdmin && !isPlatformAdmin) {
      router.replace("/welcome");
    }
  }, [isHRAdmin, isLoading, isPlatformAdmin, router]);

  if (isLoading) {
    return (
      <div className="mx-auto max-w-lg py-16 text-center font-chBody text-ch-secondary">
        Loading…
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="mx-auto max-w-lg py-16 text-center font-chBody text-ch-secondary">
        Please{" "}
        <a className="font-semibold text-ch-primary underline" href={`${getShellOrigin()}/auth/signin`}>
          sign in
        </a>{" "}
        to access this area.
      </div>
    );
  }

  if (!isPlatformAdmin) {
    return (
      <div className="mx-auto max-w-lg py-16 text-center font-chBody text-ch-secondary">
        Redirecting to your welcome page…
      </div>
    );
  }

  return <>{children}</>;
}
