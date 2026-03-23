export default function TrainingDetailLoading() {
  return (
    <div className="min-h-full animate-pulse">
      {/* Header banner skeleton */}
      <div className="border-b border-border/50 bg-white">
        <div className="h-1 w-full bg-[hsl(var(--ey-grey-200))]" />
        <div className="mx-auto max-w-5xl px-6 pt-6 pb-10 lg:px-8">
          {/* Breadcrumb */}
          <div className="mb-6 h-4 w-28 rounded ey-shimmer" />
          {/* Category + Level */}
          <div className="mb-4 flex items-center gap-3">
            <div className="h-6 w-24 rounded-full ey-shimmer" />
            <div className="h-4 w-20 rounded ey-shimmer" />
          </div>
          {/* Title */}
          <div className="space-y-2">
            <div className="h-8 w-3/4 rounded ey-shimmer" />
            <div className="h-8 w-1/2 rounded ey-shimmer" />
          </div>
          {/* Yellow bar */}
          <div className="mt-4 h-1 w-20 rounded-full ey-shimmer" />
          {/* Description */}
          <div className="mt-5 space-y-2">
            <div className="h-4 w-full rounded ey-shimmer" />
            <div className="h-4 w-5/6 rounded ey-shimmer" />
            <div className="h-4 w-2/3 rounded ey-shimmer" />
          </div>
        </div>
      </div>

      {/* Body skeleton */}
      <div className="mx-auto max-w-5xl px-6 py-8 lg:px-8">
        <div className="grid gap-8 lg:grid-cols-[1fr_340px]">
          {/* Left column */}
          <div className="space-y-8">
            {/* Stats grid */}
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <div
                  key={i}
                  className="flex flex-col items-center gap-2 rounded-xl border border-border/50 bg-white p-4"
                >
                  <div className="h-9 w-9 rounded-lg ey-shimmer" />
                  <div className="h-5 w-10 rounded ey-shimmer" />
                  <div className="h-3 w-14 rounded ey-shimmer" />
                </div>
              ))}
            </div>

            {/* Chapter list skeleton */}
            <div>
              <div className="mb-4 flex items-center gap-2.5">
                <div className="h-5 w-5 rounded ey-shimmer" />
                <div className="h-5 w-32 rounded ey-shimmer" />
              </div>
              <div className="overflow-hidden rounded-2xl border border-border/50 bg-white">
                {Array.from({ length: 6 }).map((_, i) => (
                  <div
                    key={i}
                    className="flex items-center gap-4 border-b border-border/30 px-5 py-4 last:border-b-0"
                  >
                    <div className="h-9 w-9 shrink-0 rounded-xl ey-shimmer" />
                    <div className="h-4 flex-1 rounded ey-shimmer" />
                    <div className="h-4 w-12 rounded ey-shimmer" />
                  </div>
                ))}
              </div>
            </div>

            {/* Exam skeleton */}
            <div>
              <div className="mb-4 flex items-center gap-2.5">
                <div className="h-5 w-5 rounded ey-shimmer" />
                <div className="h-5 w-32 rounded ey-shimmer" />
              </div>
              <div className="rounded-2xl border border-border/60 bg-white p-6">
                <div className="h-20 w-full rounded ey-shimmer" />
              </div>
            </div>
          </div>

          {/* Right column */}
          <div className="space-y-6">
            {/* Instructor */}
            <div className="rounded-2xl border border-border/50 bg-white p-6">
              <div className="mb-5 h-4 w-20 rounded ey-shimmer" />
              <div className="flex items-center gap-4">
                <div className="h-14 w-14 shrink-0 rounded-2xl ey-shimmer" />
                <div className="space-y-2 flex-1">
                  <div className="h-4 w-2/3 rounded ey-shimmer" />
                  <div className="h-3 w-1/2 rounded ey-shimmer" />
                </div>
              </div>
            </div>

            {/* Tags */}
            <div className="rounded-2xl border border-border/50 bg-white p-6">
              <div className="mb-3 h-4 w-14 rounded ey-shimmer" />
              <div className="flex flex-wrap gap-2">
                {Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="h-6 w-16 rounded-full ey-shimmer" />
                ))}
              </div>
            </div>

            {/* CTA */}
            <div className="h-12 w-full rounded-md ey-shimmer" />
          </div>
        </div>
      </div>
    </div>
  );
}
