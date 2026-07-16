import { Spinner } from "@/components/ui/spinner";

// Root segment fallback: with the (pages) loading boundary in place, this only
// appears on true cold boot before the pages segment streams — keep it quiet.
export default function Loading() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-6">
      <div className="flex items-center gap-3 text-sm text-muted-foreground">
        <Spinner />
        <span>Loading Core HR...</span>
      </div>
    </div>
  );
}
