"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { SearchX } from "@/lib/icons";
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
  const t = useTranslations("frame.states");
  return (
    <PageContainer width="narrow" className="py-10 sm:py-16">
      {kind === "forbidden" ? (
        <PagePermissionNotice
          headingLevel={1}
          title={t("forbidden.title")}
          description={t("forbidden.description")}
          action={
            <Button asChild variant="outline" size="sm">
              <a href={buildHomeHref()}>{t("forbidden.action")}</a>
            </Button>
          }
        />
      ) : null}

      {kind === "not-found" ? (
        <PageEmpty
          headingLevel={1}
          icon={SearchX}
          title={t("notFound.title")}
          description={t("notFound.description")}
          action={
            <Button asChild variant="outline" size="sm">
              <Link href="/">{t("notFound.action")}</Link>
            </Button>
          }
        />
      ) : null}

      {kind === "unavailable" ? (
        <PageError
          headingLevel={1}
          title={t("unavailable.title")}
          description={t("unavailable.description")}
          onRetry={onRetry}
        />
      ) : null}

      {kind === "error" ? (
        <PageError
          headingLevel={1}
          title={t("error.title")}
          description={t("error.description")}
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
