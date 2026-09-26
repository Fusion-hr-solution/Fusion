"use client";

import Link from "next/link";
import { AlertCircle, ArrowLeft, ArrowRight, CheckCircle2 } from "lucide-react";
import { Button, cn } from "@repo/ds";
import { PageContainer } from "@repo/ds/shell";

/**
 * The flow bar pinned to the bottom of Review: back to Match, and the stage's terminal action once
 * the server says the proposal can be published. A proposal with nothing to write offers its own
 * closing action instead.
 */
export function ImportReviewFooter({
  matchHref,
  blockingCount,
  canPublish,
  noop,
  busy,
  publishLabel,
  noopLabel,
  onPublish,
}: {
  matchHref: string;
  blockingCount: number;
  canPublish: boolean;
  /** Publishable, but nothing would be written. */
  noop: boolean;
  busy: boolean;
  publishLabel: string;
  noopLabel: { idle: string; busy: string; status: string; variant?: "default" | "outline" };
  onPublish: () => void;
}) {
  const blocked = !canPublish;
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
              ? blockingCount === 1
                ? "1 thing needs your attention before you can publish."
                : `${blockingCount} things need your attention before you can publish.`
              : noop
                ? noopLabel.status
                : "Ready to publish"}
          </p>
          <Button variant={noop ? (noopLabel.variant ?? "default") : "default"} disabled={blocked || busy} onClick={onPublish}>
            {noop ? (busy ? noopLabel.busy : noopLabel.idle) : publishLabel}
            {noop ? null : <ArrowRight aria-hidden />}
          </Button>
        </div>
      </PageContainer>
    </div>
  );
}
