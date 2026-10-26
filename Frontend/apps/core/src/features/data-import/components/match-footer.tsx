"use client";

import { useTranslations } from "next-intl";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { Button } from "@repo/ds";
import { PageContainer } from "@repo/ds/shell";

/**
 * The flow bar pinned to the bottom of Match: back to Upload, and on to Review once every
 * required meaning is settled. Continuing never happens by itself.
 */
export function ImportMatchFooter({
  uploadHref,
  reviewHref,
  remaining,
  canContinue,
}: {
  uploadHref: string;
  reviewHref: string;
  remaining: number;
  canContinue: boolean;
}) {
  const t = useTranslations("dataImport");
  const router = useRouter();
  return (
    <div className="sticky bottom-0 z-20 mt-8 border-t border-border bg-background">
      <PageContainer className="flex items-center justify-between gap-4 py-3">
        <Button variant="outline" asChild>
          <Link href={uploadHref}>
            <ArrowLeft aria-hidden />
            {t("matchFooter.back")}
          </Link>
        </Button>
        <div className="flex items-center gap-4">
          {remaining > 0 ? (
            <p className="hidden type-meta text-muted-foreground sm:block" aria-live="polite">
              {t("matchFooter.remaining", { count: remaining })}
            </p>
          ) : null}
          <Button disabled={!canContinue} onClick={() => router.push(reviewHref)}>
            {t("matchFooter.continue")}
            <ArrowRight aria-hidden />
          </Button>
        </div>
      </PageContainer>
    </div>
  );
}
