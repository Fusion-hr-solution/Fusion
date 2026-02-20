export default function Loading() {
  return (
    <div className="container mx-auto px-4 py-12">
      <div className="space-y-4 animate-pulse">
        <div className="h-8 bg-muted rounded w-1/3" />
        <div className="h-4 bg-muted rounded w-2/3" />
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mt-8">
          <div className="lg:col-span-2 space-y-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-40 bg-muted rounded-lg" />
            ))}
          </div>
          <div className="h-72 bg-muted rounded-lg" />
        </div>
      </div>
    </div>
  );
}
