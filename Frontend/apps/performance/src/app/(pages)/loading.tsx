import { PageContainer } from "@repo/ds/shell";
import { Skeleton } from "@/components/ui/skeleton";

// Route-group loading boundary: renders INSIDE PerformancePagesShell so the frame
// (sidebar, top bar) persists across navigation and only the content area swaps.
//
// This is the *standing* boundary that shows briefly while a sibling route's RSC
// streams in, so its shape is what every navigation flashes first. The app's
// content is card/panel-based everywhere, so we hold neutral rounded panels — never
// thin table rows, which would read as the "wrong" skeleton before cards resolve.
// Title-less by design — never fakes a page name before the target route resolves.
export default function PagesLoading() {
  return (
    <PageContainer>
      <div aria-busy aria-label="Loading page">
        <div className="mb-6 space-y-2">
          <Skeleton className="h-7 w-44" />
          <Skeleton className="h-4 w-80 max-w-full" />
        </div>
        <div className="space-y-4">
          <Skeleton className="h-28 w-full rounded-2xl" />
          <Skeleton className="h-28 w-full rounded-2xl" />
          <Skeleton className="h-28 w-full rounded-2xl" />
        </div>
      </div>
    </PageContainer>
  );
}
