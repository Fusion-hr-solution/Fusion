export default function DashboardLoading() {
  return (
    <div className="animate-pulse">
      {/* Hero skeleton */}
      <section className="border-b border-border/50 bg-white">
        <div className="px-8 py-10 lg:py-12">
          <div className="flex items-end gap-3 mb-1">
            <div className="h-9 w-1 rounded-full ey-shimmer" />
            <div className="h-3 w-28 rounded ey-shimmer" />
          </div>
          <div className="mt-3 h-9 w-48 rounded-lg ey-shimmer" />
          <div className="mt-2 h-4 w-80 max-w-full rounded ey-shimmer" />

          {/* KPI cards skeleton */}
          <div className="mt-8 grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div
                key={i}
                className="flex items-center gap-3.5 rounded-xl border border-border/60 bg-white px-4 py-4"
              >
                <div className="h-11 w-11 rounded-xl ey-shimmer" />
                <div className="space-y-2">
                  <div className="h-5 w-10 rounded ey-shimmer" />
                  <div className="h-3 w-16 rounded ey-shimmer" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Content skeleton */}
      <div className="px-8 py-8">
        <div className="grid gap-6 lg:grid-cols-3">
          {/* Left column */}
          <div className="space-y-6 lg:col-span-2">
            <div className="space-y-3">
              <div className="flex items-center gap-2.5 mb-4">
                <div className="h-7 w-7 rounded-lg ey-shimmer" />
                <div className="h-5 w-36 rounded ey-shimmer" />
              </div>
              {Array.from({ length: 3 }).map((_, i) => (
                <div
                  key={i}
                  className="rounded-xl border border-border/60 bg-white p-4"
                >
                  <div className="flex items-center gap-4">
                    <div className="h-14 w-14 rounded-full ey-shimmer" />
                    <div className="flex-1 space-y-2">
                      <div className="h-3 w-20 rounded ey-shimmer" />
                      <div className="h-4 w-48 rounded ey-shimmer" />
                      <div className="h-3 w-32 rounded ey-shimmer" />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Right column */}
          <div className="space-y-6">
            <div className="rounded-xl border border-border/60 bg-white p-5">
              <div className="flex items-center gap-2.5 mb-5">
                <div className="h-7 w-7 rounded-lg ey-shimmer" />
                <div className="h-4 w-28 rounded ey-shimmer" />
              </div>
              <div className="flex justify-center mb-5">
                <div className="h-32 w-32 rounded-full ey-shimmer" />
              </div>
              <div className="space-y-2.5">
                {Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="flex justify-between">
                    <div className="h-3 w-20 rounded ey-shimmer" />
                    <div className="h-3 w-6 rounded ey-shimmer" />
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-xl border border-border/60 bg-white p-5">
              <div className="flex items-center gap-2.5 mb-5">
                <div className="h-7 w-7 rounded-lg ey-shimmer" />
                <div className="h-4 w-32 rounded ey-shimmer" />
              </div>
              <div className="space-y-3.5">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="space-y-1.5">
                    <div className="h-3 w-16 rounded ey-shimmer" />
                    <div className="h-1.5 w-full rounded-full ey-shimmer" />
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
