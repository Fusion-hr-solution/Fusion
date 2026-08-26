import { Skeleton } from "@repo/ui";

/** Layout-matched placeholder so the page doesn't jump when the report resolves. */
export function ReportSkeleton() {
  return (
    <div className="space-y-4" aria-hidden="true">
      <Skeleton className="h-16 w-full rounded-2xl" />
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="space-y-3 rounded-2xl border border-zinc-200 bg-white p-5">
          <Skeleton className="mx-auto h-40 w-40 rounded-full" />
          <Skeleton className="h-4 w-3/4" />
          <div className="grid grid-cols-2 gap-2">
            <Skeleton className="h-16 rounded-xl" />
            <Skeleton className="h-16 rounded-xl" />
          </div>
        </div>
        <div className="space-y-3 rounded-2xl border border-zinc-200 bg-white p-5 lg:col-span-2">
          <Skeleton className="h-4 w-40" />
          {Array.from({ length: 5 }).map((_, index) => (
            <div key={index} className="space-y-1.5">
              <Skeleton className="h-3 w-1/3" />
              <Skeleton className="h-2.5 w-full rounded-full" />
            </div>
          ))}
        </div>
      </div>
      <Skeleton className="h-28 w-full rounded-2xl" />
    </div>
  );
}
