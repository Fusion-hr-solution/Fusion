"use client";

import Link from "next/link";
import { SearchX } from "lucide-react";
import { Button } from "@repo/ds/components/ui/button";
import {
  PageContainer,
  PageEmpty,
  PageError,
  PagePermissionNotice,
} from "@repo/ds/shell";

type PlatformPageStateKind =
  | "forbidden"
  | "not-found"
  | "unavailable"
  | "error";

export function PlatformPageState({
  kind,
  onRetry,
}: {
  kind: PlatformPageStateKind;
  onRetry?: () => void;
}) {
  return (
    <PageContainer width="narrow" className="py-10 sm:py-16">
      {kind === "forbidden" ? (
        <PagePermissionNotice
          headingLevel={1}
          title="Platform access required"
          description="Your account does not have access to Platform administration."
          action={
            <Button asChild variant="outline" size="sm">
              <a href={buildHomeHref()}>Return to Fusion home</a>
            </Button>
          }
        />
      ) : null}

      {kind === "not-found" ? (
        <PageEmpty
          headingLevel={1}
          icon={SearchX}
          title="Page not found"
          description="This destination does not exist in Platform administration."
          action={
            <Button asChild variant="outline" size="sm">
              <Link href="/">Return to Platform overview</Link>
            </Button>
          }
        />
      ) : null}

      {kind === "unavailable" ? (
        <PageError
          headingLevel={1}
          title="Platform administration is unavailable"
          description="The workspace could not load its required session state. Try again when the connection is restored."
          onRetry={onRetry}
        />
      ) : null}

      {kind === "error" ? (
        <PageError
          headingLevel={1}
          title="Platform administration could not load"
          description="Your access is unchanged. Try loading this page again."
          onRetry={onRetry}
        />
      ) : null}
    </PageContainer>
  );
}

function buildHomeHref(): string {
  const shellUrl = process.env.NEXT_PUBLIC_SHELL_URL;
  return shellUrl ? new URL("/", shellUrl).toString() : "/";
}
