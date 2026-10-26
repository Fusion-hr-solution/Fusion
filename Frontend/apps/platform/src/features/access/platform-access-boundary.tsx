"use client";

import { useEffect, type ReactNode } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { useAuth } from "@repo/auth";
import { PageSkeleton } from "@repo/ds/shell";
import { buildShellUrl } from "@/lib/shell-url";
import { PlatformPageState } from "@/features/states/platform-page-state";
import {
  buildPlatformCallbackUrl,
  resolvePlatformAccessState,
} from "./platform-access";

export function PlatformAccessBoundary({
  children,
}: {
  children: ReactNode;
}) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { user, isLoading } = useAuth();
  const state = resolvePlatformAccessState({ user, isLoading });
  const t = useTranslations("frame");

  useEffect(() => {
    if (state !== "sign-in-required") {
      return;
    }

    const callbackUrl = buildPlatformCallbackUrl(
      pathname,
      searchParams.toString()
    );
    const signInUrl = buildShellUrl("/auth/signin");
    signInUrl.searchParams.set("callbackUrl", callbackUrl);
    window.location.replace(signInUrl);
  }, [pathname, searchParams, state]);

  if (state === "loading" || state === "sign-in-required") {
    return <PageSkeleton rows={3} label={t("checkingAccess")} />;
  }

  if (state === "forbidden") {
    return <PlatformPageState kind="forbidden" />;
  }

  return children;
}
