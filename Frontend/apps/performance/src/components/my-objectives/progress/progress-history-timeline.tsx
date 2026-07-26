"use client";

import { ArrowDownRight, ArrowUpRight, CheckCircle2, Paperclip, Target } from "lucide-react";
import type { ObjectiveProgressUpdateDto } from "@repo/api";
import { formatDate, formatDateTime } from "@/lib/labels";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { progressTerms } from "./progress-terms";

/**
 * The append-only progress narrative for one objective, most-recent-first. Every entry shows the
 * value transition, any regression reason, comment, actual result, evidence, actor, and time. No
 * entry offers an edit or delete affordance — history is immutable by construction.
 */
export function ProgressHistoryTimeline({
  updates,
  onDownloadEvidence,
}: {
  updates: ObjectiveProgressUpdateDto[];
  onDownloadEvidence?: (attachmentId: string, fileName: string) => void;
}) {
  if (updates.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">{progressTerms.historyEmpty}</p>
    );
  }

  return (
    <ol className="relative space-y-5 border-l border-border/70 pl-5">
      {updates.map((update) => {
        const completed = update.progressPercent === 100;
        const reopened = update.isRegression && update.previousPercent === 100;
        const hasMovement =
          update.previousPercent !== null && update.previousPercent !== update.progressPercent;
        return (
          <li key={update.id} className="relative">
            <span
              className={cn(
                "absolute -left-[1.6rem] top-1.5 flex size-3 items-center justify-center rounded-full ring-4 ring-background",
                completed
                  ? "bg-emerald-500"
                  : update.isRegression
                    ? "bg-amber-500"
                    : "bg-primary",
              )}
              aria-hidden
            />

            {/* Signal row: the value + its movement lead; the timestamp recedes to the right. */}
            <div className="flex items-baseline justify-between gap-3">
              <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                <span className="text-base font-semibold tabular-nums leading-none text-foreground">
                  {update.progressPercent}%
                </span>
                {hasMovement ? (
                  <span
                    className={cn(
                      "inline-flex items-center gap-0.5 text-xs font-medium tabular-nums",
                      update.isRegression
                        ? "text-amber-700 dark:text-amber-300"
                        : "text-emerald-700 dark:text-emerald-300",
                    )}
                  >
                    {update.isRegression ? (
                      <ArrowDownRight className="size-3.5" />
                    ) : (
                      <ArrowUpRight className="size-3.5" />
                    )}
                    {progressTerms.from} {update.previousPercent}%
                  </span>
                ) : null}
                {completed ? (
                  <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700 dark:text-emerald-300">
                    <CheckCircle2 className="size-3.5" />
                    {progressTerms.completedTag}
                  </span>
                ) : null}
                {reopened ? (
                  <span className="rounded-full bg-amber-500/12 px-2 py-0.5 text-xs font-medium text-amber-700 dark:text-amber-300">
                    {progressTerms.reopenedTag}
                  </span>
                ) : null}
              </div>
              <time
                dateTime={update.recordedAt}
                title={formatDateTime(update.recordedAt)}
                className="shrink-0 text-xs tabular-nums text-muted-foreground"
              >
                {formatDate(update.recordedAt)}
              </time>
            </div>

            {update.isRegression && update.regressionReason ? (
              <p className="mt-2 rounded-md bg-amber-500/8 px-2.5 py-1.5 text-sm text-amber-900 dark:text-amber-200">
                {update.regressionReason}
              </p>
            ) : null}

            {/* The measured result is data, not prose: an icon marks it so no repeated label is needed. */}
            {update.actualValue ? (
              <p className="mt-1.5 flex items-center gap-1.5 text-sm text-muted-foreground">
                <Target className="size-3.5 shrink-0" aria-hidden />
                <span className="tabular-nums text-foreground">{update.actualValue}</span>
              </p>
            ) : null}

            {update.comment ? (
              <p className="mt-1.5 text-sm leading-snug text-foreground/90">{update.comment}</p>
            ) : null}

            {/* Provenance recedes to the foot: who, and any proof. */}
            <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1.5">
              {update.evidence.map((file) => (
                <Button
                  key={file.id}
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-7 gap-1.5 text-xs"
                  onClick={() => onDownloadEvidence?.(file.id, file.fileName)}
                >
                  <Paperclip className="size-3.5" />
                  {file.fileName}
                </Button>
              ))}
              <span className="text-xs text-muted-foreground">
                {progressTerms.by} {update.actorName}
              </span>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
