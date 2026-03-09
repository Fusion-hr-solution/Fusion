export default function Loading() {
  return (
    <div className="min-h-screen bg-white">
      {/* Nav skeleton */}
      <div className="h-16 border-b border-zinc-200 animate-pulse bg-white" />
      <div className="flex">
        {/* Sidebar skeleton */}
        <div className="w-72 min-h-screen border-r border-zinc-200 p-6 space-y-4 animate-pulse">
          <div className="h-8 bg-zinc-100 rounded w-3/4" />
          <div className="h-10 bg-zinc-100 rounded" />
          <div className="space-y-2 pt-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-5 bg-zinc-100 rounded w-full" />
            ))}
          </div>
        </div>
        {/* Main skeleton */}
        <div className="flex-1 p-8 space-y-6 animate-pulse">
          <div className="grid grid-cols-4 gap-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-24 bg-zinc-100 rounded-xl" />
            ))}
          </div>
          <div className="grid grid-cols-3 gap-6">
            {Array.from({ length: 9 }).map((_, i) => (
              <div key={i} className="h-52 bg-zinc-100 rounded-xl" />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}