"use client";

import { Skeleton } from "@repo/ds/components/ui/skeleton";
import { PageContainer } from "@repo/ds/shell";

/**
 * My Plan's loading state in its real frame: direction band, then the objectives ledger beside the
 * snapshot + next-steps rail, so the surface fills in place rather than swapping layouts.
 */
export function PlanSurfaceSkeleton() {
  return (
    <div className="space-y-4" role="status" aria-label="Loading your plan">
      {/* Direction band: scope mark + title, then team / reviewer facts. */}
      <div className="flex flex-wrap items-center gap-x-6 gap-y-4 rounded-surface border border-border bg-card px-4 py-3">
        <div className="flex items-center gap-3">
          <Skeleton className="size-12 rounded-control" />
          <div className="space-y-1.5">
            <Skeleton className="h-3 w-24" />
            <Skeleton className="h-4 w-56" />
          </div>
        </div>
        <div className="flex items-center gap-6 lg:border-l lg:border-border/60 lg:pl-6">
          {Array.from({ length: 2 }, (_, i) => (
            <div key={i} className="flex items-center gap-2.5">
              <Skeleton className="size-5 rounded-detail" />
              <div className="space-y-1.5">
                <Skeleton className="h-3 w-14" />
                <Skeleton className="h-4 w-28" />
              </div>
            </div>
          ))}
        </div>
        <Skeleton className="h-8 w-32 rounded-control lg:ml-auto" />
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_20rem]">
        {/* Objectives ledger: rows mirror PlanObjectiveRow (identity, facts + weight, progress) and share
            the ledger's height so it meets the rail's bottom edge. */}
        <section className="flex flex-col rounded-surface border border-border bg-card">
          <div className="flex items-center justify-between border-b border-border px-5 py-3">
            <Skeleton className="h-3 w-28" />
            <Skeleton className="h-8 w-32 rounded-control" />
          </div>
          <div className="flex flex-1 flex-col gap-3 p-4">
            {Array.from({ length: 2 }, (_, i) => (
              <div
                key={i}
                className="flex flex-1 flex-col justify-between rounded-surface border border-border bg-inlay p-5"
              >
                <div className="flex items-start gap-4">
                  <Skeleton className="size-10 shrink-0 rounded-control" />
                  <div className="min-w-0 flex-1 space-y-2 pt-0.5">
                    <Skeleton className="h-4 w-3/5" />
                    <Skeleton className="h-3 w-2/5" />
                  </div>
                </div>
                <div className="mt-4 flex items-end gap-3 pl-14">
                  <div className="flex min-w-0 flex-1 gap-8">
                    {["w-28", "w-24", "w-40"].map((width, j) => (
                      <div key={j} className={j === 2 ? "hidden space-y-2 sm:block" : "space-y-2"}>
                        <Skeleton className="h-3 w-20" />
                        <Skeleton className={`h-4 ${width}`} />
                      </div>
                    ))}
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1.5">
                    <Skeleton className="h-5 w-10" />
                    <Skeleton className="h-3 w-12" />
                  </div>
                </div>
                <div className="mt-4 flex items-center gap-4 border-t border-border/60 pt-4">
                  <div className="min-w-0 flex-1 space-y-2">
                    <Skeleton className="h-3 w-24" />
                    <Skeleton className="h-1.5 w-full rounded-full" />
                    <Skeleton className="h-3 w-32" />
                  </div>
                  <Skeleton className="h-8 w-32 shrink-0 rounded-control" />
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Rail: snapshot donut + facts, then the three-step path. */}
        <aside className="flex flex-col gap-4">
          <section className="rounded-surface border border-border bg-card p-5">
            <Skeleton className="h-3 w-24" />
            <div className="mt-5 flex items-center gap-5">
              <Skeleton className="size-32 shrink-0 rounded-full" />
              <div className="flex-1 space-y-5">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-4 w-20" />
              </div>
            </div>
          </section>
          <section className="flex-1 rounded-surface border border-border bg-card p-5">
            <Skeleton className="h-3 w-20" />
            <div className="mt-5 space-y-6">
              {Array.from({ length: 3 }, (_, i) => (
                <div key={i} className="flex gap-3.5">
                  <Skeleton className="size-8 shrink-0 rounded-full" />
                  <div className="flex-1 space-y-1.5 pt-1">
                    <Skeleton className="h-4 w-32" />
                    <Skeleton className="h-3 w-full" />
                  </div>
                </div>
              ))}
            </div>
          </section>
        </aside>
      </div>
    </div>
  );
}

/** Page-level loading: the My Plan heading and subtitle, then the surface skeleton. */
export function PlanPageSkeleton() {
  return (
    <PageContainer className="max-w-7xl">
      <div className="mb-4 space-y-2.5">
        <Skeleton className="h-8 w-44" />
        <Skeleton className="h-4 w-40" />
      </div>
      <PlanSurfaceSkeleton />
    </PageContainer>
  );
}
