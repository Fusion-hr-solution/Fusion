"use client";

import { PageContainer } from "@repo/ds/shell";
import { Skeleton } from "@repo/ds/components/ui/skeleton";

/**
 * Loading placeholder for the organizational-objective composer route — mirrors its real
 * shape (parent band, page title, and the stacked definition + measurement blocks) so the
 * page holds its layout while the cycle and parent/objective resolve, rather than flashing a
 * generic row skeleton and then reflowing.
 */
export function ComposerSkeleton() {
  return (
    <PageContainer width="narrow">
      {/* Cycle context bar */}
      <div className="mb-5 flex items-center gap-3">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-4 w-16" />
        <Skeleton className="h-4 w-40" />
      </div>

      {/* Back link + title */}
      <div className="mb-6 space-y-3">
        <Skeleton className="h-4 w-36" />
        <Skeleton className="h-3.5 w-28" />
        <Skeleton className="h-8 w-72" />
      </div>

      {/* Parent objective band */}
      <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
        <div className="flex items-start justify-between gap-4">
          <div className="w-full space-y-2">
            <Skeleton className="h-3 w-28" />
            <Skeleton className="h-5 w-56" />
            <Skeleton className="h-3.5 w-40" />
          </div>
          <Skeleton className="h-5 w-20 rounded-full" />
        </div>
      </div>

      {/* Objective details block */}
      <div className="mt-6 space-y-6">
        <div className="rounded-2xl border border-border bg-card p-5 shadow-sm sm:p-6">
          <Skeleton className="h-5 w-36" />
          <div className="mt-4 space-y-4">
            <Field />
            <div className="space-y-1.5">
              <Skeleton className="h-3.5 w-24" />
              <Skeleton className="h-16 w-full rounded-xl" />
            </div>
            <div className="h-px bg-border/60" />
            <div className="grid gap-4 sm:grid-cols-2">
              <Field />
              <Field />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <Field />
              <Field />
            </div>
          </div>
        </div>

        {/* Measurement block */}
        <div className="rounded-2xl border border-border bg-card p-5 shadow-sm sm:p-6">
          <Skeleton className="h-5 w-32" />
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <Skeleton className="h-[68px] w-full rounded-xl" />
            <Skeleton className="h-[68px] w-full rounded-xl" />
          </div>
          <div className="mt-4 grid grid-cols-3 gap-2.5">
            <Skeleton className="h-10 w-full rounded-xl" />
            <Skeleton className="h-10 w-full rounded-xl" />
            <Skeleton className="h-10 w-full rounded-xl" />
          </div>
        </div>
      </div>
    </PageContainer>
  );
}

function Field() {
  return (
    <div className="space-y-1.5">
      <Skeleton className="h-3.5 w-24" />
      <Skeleton className="h-8 w-full rounded-xl" />
    </div>
  );
}
