export default function Loading() {
  return (
    <div className="container mx-auto px-4 py-12">
      <div className="space-y-4 animate-pulse">
        <div className="h-8 bg-muted rounded w-1/3" />
        <div className="h-4 bg-muted rounded w-2/3" />
        <div className="h-10 bg-muted rounded w-80 mt-4" />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mt-8">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-64 bg-muted rounded-lg" />
          ))}
        </div>
      </div>
    </div>
  );
}
