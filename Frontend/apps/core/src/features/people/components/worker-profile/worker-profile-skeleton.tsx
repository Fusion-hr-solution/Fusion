import { Skeleton } from "@repo/ds";
import { PageContainer } from "@repo/ds/shell";

/**
 * Loading skeleton for the shared worker profile. Mirrors the real `WorkerProfile`
 * geometry — eyebrow, hero (monogram + identity + fact row), then the two-column
 * card grid — so the page resolves in place instead of a blank-screen reset (§33.16).
 */
export function WorkerProfileSkeleton({
  showEyebrow = false,
  showBackLink = false,
}: {
  showEyebrow?: boolean;
  showBackLink?: boolean;
} = {}) {
  return (
    <PageContainer width="wide" className="max-w-6xl space-y-6 pb-16">
      {showBackLink ? <Skeleton className="h-5 w-20" /> : null}
      {showEyebrow ? <Skeleton className="h-3 w-16" /> : null}

      {/* Hero */}
      <section className="rounded-2xl border bg-card p-6 sm:p-7">
        <div className="flex items-start gap-5">
          <Skeleton className="size-16 shrink-0 rounded-object" />
          <div className="flex-1 space-y-2.5 pt-1">
            <Skeleton className="h-8 w-64 max-w-full" />
            <Skeleton className="h-4 w-48" />
            <Skeleton className="h-3.5 w-32" />
          </div>
        </div>
        <div className="mt-6 grid gap-6 border-t pt-5 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <div key={index} className="flex items-center gap-3">
              <Skeleton className="size-9 shrink-0 rounded-full" />
              <div className="min-w-0 flex-1 space-y-1.5">
                <Skeleton className="h-3 w-16" />
                <Skeleton className="h-4 w-24" />
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Two-column card grid */}
      <div className="grid gap-6 lg:grid-cols-2 lg:items-start">
        <div className="space-y-6">
          <CardSkeleton rows={3} />
          <CardSkeleton rows={2} />
        </div>
        <div className="space-y-6">
          <CardSkeleton rows={2} />
          <CardSkeleton rows={3} />
        </div>
      </div>
    </PageContainer>
  );
}

function CardSkeleton({ rows }: { rows: number }) {
  return (
    <section className="overflow-hidden rounded-2xl border bg-card">
      <header className="flex items-center gap-3 border-b px-6 py-4">
        <Skeleton className="size-9 shrink-0 rounded-object" />
        <Skeleton className="h-4 w-40" />
      </header>
      <div className="grid gap-x-6 gap-y-5 px-6 py-5 sm:grid-cols-2">
        {Array.from({ length: rows * 2 }).map((_, index) => (
          <div key={index} className="space-y-1.5">
            <Skeleton className="h-3 w-20" />
            <Skeleton className="h-4 w-28" />
          </div>
        ))}
      </div>
    </section>
  );
}
