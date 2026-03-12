export default function Loading() {
  return (
    <div className="flex h-screen w-full items-center justify-center bg-zinc-50">
      <div className="flex flex-col items-center gap-3">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-zinc-200 border-t-zinc-900" />
        <p className="text-sm text-zinc-500">Loading...</p>
      </div>
    </div>
  );
}