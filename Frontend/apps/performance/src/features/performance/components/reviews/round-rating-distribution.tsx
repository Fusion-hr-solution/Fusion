"use client";

import Link from "next/link";
import { useState } from "react";
import type { ReviewRatingCountDto } from "@repo/api";
import { cn } from "@repo/ds/lib/utils";
import { ChevronDown } from "@/lib/icons";
import { reviewHref, withCycle } from "@/lib/performance-routes";

/**
 * The round's ratings as one bar per scale level on a shared axis, for round administrators only (the server
 * serves it nowhere else). Each level opens in place to the reviews behind its count.
 */
export function RoundRatingDistribution({ levels, cycleId }: { levels: ReviewRatingCountDto[]; cycleId: string }) {
  const [open, setOpen] = useState<number | null>(null);
  const rated = levels.reduce((total, level) => total + level.count, 0);
  const max = Math.max(1, ...levels.map((level) => level.count));
  return (
    <section aria-labelledby="round-ratings-title" className="mt-8 max-w-5xl">
      <div className="mb-3 flex items-baseline gap-3">
        <h2 id="round-ratings-title" className="type-section-title text-foreground">Ratings</h2>
        <span className="type-meta tabular-nums text-muted-foreground">{rated} rated</span>
      </div>
      {rated === 0 ? <p className="py-2 text-sm text-muted-foreground">Ratings appear as reviewers submit their assessments.</p> : (
        <ol className="divide-y divide-border border-y border-border">
          {levels.map((level) => {
            const expanded = open === level.value;
            return (
              <li key={level.value}>
                <button
                  type="button"
                  aria-expanded={expanded}
                  disabled={level.count === 0}
                  onClick={() => setOpen(expanded ? null : level.value)}
                  className="group grid min-h-11 w-full grid-cols-[minmax(7rem,12rem)_minmax(0,1fr)_2.5rem_1rem] items-center gap-4 py-2 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-default"
                >
                  <span className="truncate text-sm text-foreground">{level.label}</span>
                  <span className="h-2 rounded-full bg-muted-foreground/15" aria-hidden>
                    <span className="block h-full rounded-full bg-primary transition-[width] duration-200" style={{ width: `${(level.count / max) * 100}%` }} />
                  </span>
                  <span className={cn("text-right text-sm tabular-nums", level.count ? "text-foreground" : "text-muted-foreground")}>{level.count}</span>
                  {level.count ? <ChevronDown aria-hidden className={cn("size-4 text-muted-foreground transition-transform", expanded && "rotate-180")} /> : <span />}
                </button>
                {expanded ? (
                  <ul className="pb-3 pl-4">
                    {level.reviews.map((review) => (
                      <li key={review.reviewId}>
                        <Link href={withCycle(reviewHref(review.reviewId), cycleId)} className="inline-flex min-h-8 items-center text-sm text-foreground underline decoration-border underline-offset-4 hover:decoration-foreground">
                          {review.subjectDisplayName}
                        </Link>
                      </li>
                    ))}
                  </ul>
                ) : null}
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}
