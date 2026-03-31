export default function Loading() {
  return (
    <div>
      {/* Hero skeleton */}
      <section className="border-b border-border/50 bg-white">
        <div className="px-8 py-12 lg:py-16">
          <div className="flex items-end gap-3 mb-1">
            <div className="h-9 w-1 rounded-full ey-shimmer" />
            <div className="h-3 w-20 rounded ey-shimmer" />
          </div>
          <div className="mt-3 h-9 w-64 rounded-lg ey-shimmer" />
          <div className="mt-3 h-4 w-96 max-w-full rounded ey-shimmer" />
          <div className="mt-6 h-11 w-80 max-w-full rounded-lg ey-shimmer" />
        </div>
      </section>

      {/* Filters skeleton */}
      <div className="px-8 py-8">
        <div className="flex gap-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <div
              key={i}
              className="h-8 rounded-full ey-shimmer"
              style={{ width: `${64 + i * 12}px` }}
            />
          ))}
        </div>

        <div className="mt-3 flex gap-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-6 w-20 rounded-full ey-shimmer" />
          ))}
        </div>

        <div className="mt-8 flex items-center justify-between">
          <div className="h-4 w-36 rounded ey-shimmer" />
          <div className="h-7 w-28 rounded-lg ey-shimmer" />
        </div>

        {/* Card grid skeleton */}
        <div className="mt-5 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="rounded-lg border border-border/40 bg-white overflow-hidden"
            >
              <div className="h-1 w-full ey-shimmer" />
              <div className="p-5 space-y-4">
                <div className="flex justify-between">
                  <div className="h-5 w-20 rounded-full ey-shimmer" />
                  <div className="h-4 w-16 rounded ey-shimmer" />
                </div>
                <div className="h-4 w-4/5 rounded ey-shimmer" />
                <div className="space-y-2">
                  <div className="h-3 w-full rounded ey-shimmer" />
                  <div className="h-3 w-2/3 rounded ey-shimmer" />
                </div>
                <div className="flex gap-2">
                  <div className="h-6 w-16 rounded-md ey-shimmer" />
                  <div className="h-6 w-20 rounded-md ey-shimmer" />
                </div>
                <div className="border-t border-border/30 pt-3 flex justify-between">
                  <div className="flex items-center gap-2">
                    <div className="h-7 w-7 rounded-full ey-shimmer" />
                    <div className="h-3 w-24 rounded ey-shimmer" />
                  </div>
                  <div className="flex gap-3">
                    <div className="h-3 w-8 rounded ey-shimmer" />
                    <div className="h-3 w-10 rounded ey-shimmer" />
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
