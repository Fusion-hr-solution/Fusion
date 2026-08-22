"use client";

import { useEffect, type ReactNode } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { useHydratedWorkspaceAccess } from "@repo/auth";
import {
  PageContainer,
  PageHeader,
  PagePermissionNotice,
  PageSkeleton,
} from "@repo/ds/shell";
import { Button } from "@repo/ds/components/ui/button";
import { buildShellUrl } from "@/lib/shell-url";
import {
  buildPerformanceCallbackUrl,
  resolvePerformanceWorkspaceAccessState,
} from "./performance-workspace-access";

export function PerformanceWorkspaceAccessBoundary({
  children,
}: {
  children: ReactNode;
}) {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // The shared hydration-safe mechanism holds the first client render equal to
  // the server's until hydration settles, then resolves access from session
  // claims. This is what keeps Performance from regenerating its subtree during
  // hydration — the guard now lives in @repo/auth so it cannot be forgotten.
  const { state } = useHydratedWorkspaceAccess(
    resolvePerformanceWorkspaceAccessState,
  );

  useEffect(() => {
    if (state !== "sign-in-required") {
      return;
    }

    const callbackUrl = buildPerformanceCallbackUrl(
      pathname,
      searchParams.toString()
    );
    const signInUrl = buildShellUrl("/auth/signin");
    signInUrl.searchParams.set("callbackUrl", callbackUrl);
    window.location.replace(signInUrl);
  }, [pathname, searchParams, state]);

  if (state === "loading" || state === "sign-in-required") {
    return <PageSkeleton rows={4} label="Checking Performance access" />;
  }

  if (state === "forbidden") {
    return (
      <PageContainer className="space-y-6">
        <PageHeader
          title="Performance is a customer workspace"
          description="Platform administration is kept separate from customer performance data."
        />
        <PagePermissionNotice
          title="Performance is not available to Platform Administrators"
          description="Use the Platform control plane for platform-level administration."
          action={
            <Button asChild>
              <a href={buildShellUrl("/platform").toString()}>Open Platform</a>
            </Button>
          }
        />
      </PageContainer>
    );
  }

  return children;
}
