export default function AdminLoading() {
  return (
    <div className="animate-pulse">
      {/* Hero skeleton */}
      <section className="border-b border-border/50 bg-card">
        <div className="px-8 py-10 lg:py-12">
          <div className="flex items-end gap-3 mb-1">
            <div className="h-9 w-1 rounded-full ey-shimmer" />
            <div className="h-3 w-24 rounded ey-shimmer" />
          </div>
          <div className="mt-3 h-9 w-64 rounded-lg ey-shimmer" />
          <div className="mt-2 h-4 w-96 max-w-full rounded ey-shimmer" />

          {/* KPI cards skeleton */}
          <div className="mt-8 grid grid-cols-2 gap-3 lg:grid-cols-5 lg:gap-4">
            {Array.from({ length: 5 }).map((_, i) => (
              <div
                key={i}
                className="flex items-center gap-3 rounded-xl border border-border/60 bg-card px-4 py-3.5"
              >
                <div className="h-10 w-10 rounded-xl ey-shimmer" />
                <div className="space-y-2">
                  <div className="h-5 w-8 rounded ey-shimmer" />
                  <div className="h-3 w-14 rounded ey-shimmer" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Content skeleton */}
      <div className="px-8 py-8">
        <div className="grid gap-6 lg:grid-cols-3">
          {/* Left column — employee list */}
          <div className="space-y-5 lg:col-span-2">
            {/* Filters */}
            <div className="flex gap-3">
              <div className="h-9 flex-1 max-w-sm rounded-lg ey-shimmer" />
              <div className="h-9 w-32 rounded-lg ey-shimmer" />
              <div className="h-9 w-28 rounded-lg ey-shimmer" />
            </div>

            {/* Employee cards */}
            <div className="space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <div
                  key={i}
                  className="flex items-center gap-4 rounded-xl border border-border/60 bg-card p-4"
                >
                  <div className="h-10 w-10 rounded-full ey-shimmer" />
                  <div className="flex-1 space-y-2">
                    <div className="h-4 w-32 rounded ey-shimmer" />
                    <div className="h-3 w-44 rounded ey-shimmer" />
                  </div>
                  <div className="hidden sm:flex flex-col items-end gap-1">
                    <div className="h-3 w-8 rounded ey-shimmer" />
                    <div className="h-1.5 w-20 rounded-full ey-shimmer" />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Right column — charts */}
          <div className="space-y-6">
            <div className="rounded-xl border border-border/60 bg-card p-5">
              <div className="flex items-center gap-2.5 mb-5">
                <div className="h-7 w-7 rounded-lg ey-shimmer" />
                <div className="h-4 w-28 rounded ey-shimmer" />
              </div>
              <div className="h-4 w-full rounded-full ey-shimmer mb-5" />
              <div className="space-y-2.5">
                {Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="flex justify-between">
                    <div className="h-3 w-20 rounded ey-shimmer" />
                    <div className="h-3 w-12 rounded ey-shimmer" />
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-xl border border-border/60 bg-card p-5">
              <div className="flex items-center gap-2.5 mb-5">
                <div className="h-7 w-7 rounded-lg ey-shimmer" />
                <div className="h-4 w-36 rounded ey-shimmer" />
              </div>
              <div className="space-y-4">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="space-y-1.5">
                    <div className="h-3 w-16 rounded ey-shimmer" />
                    <div className="h-2 w-full rounded-full ey-shimmer" />
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
