"use client";

import Link from "next/link";
import { AlertCircle, ArrowLeft, ArrowRight, CheckCircle2 } from "lucide-react";
import { Button, cn } from "@repo/ds";
import { PageContainer } from "@repo/ds/shell";
import type { OrganizationImportReviewReadiness } from "@repo/api";

/**
 * The flow bar pinned to the bottom of Review: back to Match, and publication once the server
 * says the proposal can be published. A proposal with nothing new finishes without writing.
 */
export function ReviewFooter({
  matchHref,
  readiness,
  publishing,
  onPublish,
}: {
  matchHref: string;
  readiness: OrganizationImportReviewReadiness;
  publishing: boolean;
  onPublish: () => void;
}) {
  const blocked = !readiness.canPublish;
  const noop = !blocked && readiness.createCount === 0;
  const count = readiness.blockingIssueCount;
  return (
    <div className="sticky bottom-0 z-20 mt-8 border-t border-border bg-background/90 backdrop-blur supports-[backdrop-filter]:bg-background/75">
      <PageContainer className="flex items-center justify-between gap-4 py-3">
        <Button variant="outline" asChild>
          <Link href={matchHref}>
            <ArrowLeft aria-hidden />
            Back to Match
          </Link>
        </Button>
        <div className="flex items-center gap-4">
          <p
            className={cn("hidden items-center gap-2 type-meta sm:flex", blocked ? "text-destructive" : "text-foreground")}
            aria-live="polite"
          >
            {blocked ? (
              <AlertCircle aria-hidden className="size-4" />
            ) : (
              <CheckCircle2 aria-hidden className="size-4 fill-success/15 text-success" />
            )}
            {blocked
              ? count === 1
                ? "1 thing needs your attention before you can publish."
                : `${count} things need your attention before you can publish.`
              : "Ready to publish"}
          </p>
          <Button disabled={blocked || publishing} onClick={onPublish}>
            {noop ? (publishing ? "Finishing…" : "Finish import") : "Publish organization"}
            {noop ? null : <ArrowRight aria-hidden />}
          </Button>
        </div>
      </PageContainer>
    </div>
  );
}
