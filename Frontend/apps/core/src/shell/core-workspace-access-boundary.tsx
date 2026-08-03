"use client";

import { useEffect, useState, type ReactNode } from "react";
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

  // The session is restored by an effect in AuthProvider, which can run while
  // React is still hydrating this subtree. Resolving access before that point
  // would render the workspace against server HTML that still holds the
  // skeleton, and React discards the whole tree and rebuilds it on the client.
  //
  // Holding the first client render equal to the server's keeps hydration
  // intact. It only ever delays showing the workspace — an unresolved session
  // stays on the skeleton — so the gate cannot open earlier than before.
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => setHydrated(true), []);

  const state = hydrated
    ? resolveCoreWorkspaceAccessState({ user, isLoading })
    : "loading";

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
