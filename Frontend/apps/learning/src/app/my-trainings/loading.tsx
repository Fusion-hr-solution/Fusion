export default function MyTrainingsLoading() {
  return (
    <div className="animate-pulse">
      {/* Hero skeleton */}
      <section className="border-b border-border/50 bg-white">
        <div className="px-8 py-10 lg:py-12">
          <div className="flex items-end gap-3 mb-1">
            <div className="h-9 w-1 rounded-full ey-shimmer" />
            <div className="h-3 w-24 rounded ey-shimmer" />
          </div>
          <div className="mt-3 h-9 w-56 rounded-lg ey-shimmer" />
          <div className="mt-2 h-4 w-80 max-w-full rounded ey-shimmer" />

          {/* Stat cards skeleton */}
          <div className="mt-8 grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div
                key={i}
                className="flex items-center gap-3.5 rounded-xl border border-border/60 bg-white px-4 py-4"
              >
                <div className="h-10 w-10 rounded-xl ey-shimmer" />
                <div className="space-y-2">
                  <div className="h-5 w-8 rounded ey-shimmer" />
                  <div className="h-3 w-16 rounded ey-shimmer" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Tabs + content skeleton */}
      <div className="px-8 py-8">
        {/* Tabs */}
        <div className="flex gap-2 mb-6">
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className="h-9 rounded-lg ey-shimmer"
              style={{ width: `${80 + i * 10}px` }}
            />
          ))}
        </div>

        {/* Cards */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="rounded-xl border border-border/60 bg-white overflow-hidden"
            >
              <div className="h-1 w-full ey-shimmer" />
              <div className="p-5 space-y-4">
                <div className="flex justify-between">
                  <div className="h-5 w-20 rounded-full ey-shimmer" />
                  <div className="h-5 w-16 rounded-full ey-shimmer" />
                </div>
                <div className="h-4 w-3/4 rounded ey-shimmer" />
                <div className="space-y-2">
                  <div className="h-3 w-full rounded ey-shimmer" />
                  <div className="h-3 w-1/2 rounded ey-shimmer" />
                </div>
                <div className="h-2 w-full rounded-full ey-shimmer" />
                <div className="flex justify-between">
                  <div className="h-3 w-16 rounded ey-shimmer" />
                  <div className="h-3 w-10 rounded ey-shimmer" />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
