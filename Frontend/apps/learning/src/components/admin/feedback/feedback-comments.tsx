"use client";

import { useFormatter } from "next-intl";
import { Star } from "lucide-react";
import type { FeedbackComment } from "@/types/admin";

interface FeedbackCommentsProps {
  title: string;
  comments: FeedbackComment[];
  suppressed: boolean;
  suppressedLabel: string;
  emptyLabel: string;
  showTraining?: boolean;
}

export function FeedbackComments({
  title,
  comments,
  suppressed,
  suppressedLabel,
  emptyLabel,
  showTraining = false,
}: FeedbackCommentsProps) {
  const format = useFormatter();

  return (
    <div className="rounded-xl border border-border/60 bg-card p-5 shadow-sm">
      <h3 className="mb-4 text-sm font-semibold text-foreground">{title}</h3>
      {suppressed ? (
        <p className="text-sm text-muted-foreground">{suppressedLabel}</p>
      ) : comments.length === 0 ? (
        <p className="text-sm text-muted-foreground">{emptyLabel}</p>
      ) : (
        <ul className="space-y-3">
          {comments.map((c, i) => (
            <li
              key={`${c.author}-${c.submittedAt}-${i}`}
              className="rounded-lg border border-border/40 bg-muted/30 p-3"
            >
              <div className="mb-1 flex items-center justify-between gap-2">
                <span className="text-xs font-medium text-foreground">{c.author}</span>
                <span className="inline-flex shrink-0 items-center gap-1 text-xs text-muted-foreground">
                  <Star
                    className="h-3.5 w-3.5 text-[hsl(var(--ey-yellow))]"
                    fill="currentColor"
                    aria-hidden="true"
                  />
                  {c.overallRating}
                </span>
              </div>
              {showTraining && c.trainingTitle ? (
                <p className="mb-1 text-[11px] font-medium text-muted-foreground">{c.trainingTitle}</p>
              ) : null}
              <p className="text-sm text-foreground">{c.comment}</p>
              <p className="mt-1 text-[11px] text-muted-foreground">
                {format.dateTime(new Date(c.submittedAt), { dateStyle: "medium" })}
              </p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
