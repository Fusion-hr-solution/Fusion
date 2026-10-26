"use client";

import Link from "next/link";
import { Button } from "@repo/ds/components/ui/button";
import { PageContainer, PageError } from "@repo/ds/shell";
import { useTranslations } from "next-intl";

/** An unexpected render failure stays inside the Performance frame with a way to retry or leave. */
export default function PerformanceError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const t = useTranslations("common.PerformanceError");
  return (
    <PageContainer className="space-y-4">
      <PageError headingLevel={1} title={t("thisPageCouldntLoad")} onRetry={reset} />
      <div className="flex justify-center">
        <Button asChild variant="ghost">
          <Link href="/">{t("goToOverview")}</Link>
        </Button>
      </div>
    </PageContainer>
  );
}
