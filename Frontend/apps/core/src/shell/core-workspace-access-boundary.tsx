"use client";

import { useEffect, type ReactNode } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { canAccessPlatform, useHydratedWorkspaceAccess } from "@repo/auth";
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

  // The shared hydration-safe mechanism holds the first client render equal to
  // the server's until hydration settles, then resolves access from session
  // claims — so this boundary can never drift back into a hydration mismatch.
  const { state, user } = useHydratedWorkspaceAccess(({ user, isLoading }) =>
    resolveCoreWorkspaceAccessState({ user, isLoading, pathname }),
  );

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
    if (!canAccessPlatform(user)) {
      return (
        <PageContainer className="space-y-6">
          <PageHeader
            title="Access denied"
            description="You do not have permission to open this area."
          />
          <PagePermissionNotice
            title="This area is not available to your account"
            description="Open another Fusion area you can use, or contact your administrator if you expected access."
            action={
              <Button asChild variant="outline">
                <a href={buildShellUrl("/").toString()}>Open Fusion</a>
              </Button>
            }
          />
        </PageContainer>
      );
    }
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

  if (state === "module-unavailable") {
    return (
      <PageContainer className="space-y-6">
        <PageHeader
          title="Core HR is not available"
          description="This tenant does not currently have the Core HR module enabled."
        />
        <PagePermissionNotice
          title="Module unavailable"
          description="Contact your Fusion administrator if Core HR should be enabled for this tenant."
          action={
            <Button asChild variant="outline">
              <a href={buildShellUrl("/").toString()}>Open Fusion</a>
            </Button>
          }
        />
      </PageContainer>
    );
  }

  if (state === "allowed") return children;

  return <PageSkeleton rows={4} label="Checking Core HR access" />;
}
