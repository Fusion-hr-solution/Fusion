"use client";

import { useEffect, type ReactNode } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { useAuth } from "@repo/auth";
import {
  PageContainer,
  PageHeader,
  PagePermissionNotice,
  PageSkeleton,
} from "@repo/ds/shell";
import { Button } from "@/components/ui/button";
import { buildShellUrl } from "@/lib/shell-url";
import {
  buildCoreCallbackUrl,
  resolveCoreWorkspaceAccessState,
} from "./core-workspace-access";

export function CoreWorkspaceAccessBoundary({
  children,
}: {
  children: ReactNode;
}) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { user, isLoading } = useAuth();
  const state = resolveCoreWorkspaceAccessState({ user, isLoading });

  useEffect(() => {
    if (state !== "sign-in-required") {
      return;
    }

    const callbackUrl = buildCoreCallbackUrl(pathname, searchParams.toString());
    const signInUrl = buildShellUrl("/auth/signin");
    signInUrl.searchParams.set("callbackUrl", callbackUrl);
    window.location.replace(signInUrl);
  }, [pathname, searchParams, state]);

  if (state === "loading" || state === "sign-in-required") {
    return <PageSkeleton rows={4} label="Checking Core HR access" />;
  }

  if (state === "forbidden") {
    return (
      <PageContainer className="space-y-6">
        <PageHeader
          title="Core HR is a customer workspace"
          description="Platform administration is kept separate from customer workforce data."
        />
        <PagePermissionNotice
          title="Core HR is not available to Platform Administrators"
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
