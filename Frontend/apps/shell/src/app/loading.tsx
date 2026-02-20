export default function Loading() {
  return (
    <div className="container mx-auto px-4 py-12">
      <div className="space-y-4 animate-pulse">
        <div className="h-12 bg-muted rounded w-1/3 mx-auto" />
        <div className="h-4 bg-muted rounded w-2/3 mx-auto" />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-6xl mx-auto mt-12">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-52 bg-muted rounded-lg" />
          ))}
        </div>
      </div>
    </div>
  );
}
