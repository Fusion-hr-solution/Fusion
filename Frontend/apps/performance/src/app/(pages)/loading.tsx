import { PageSkeleton } from "@repo/ds/shell";

// Route-group loading boundary: renders INSIDE PerformancePagesShell so the
// frame (sidebar, top bar) persists across navigation and only the content
// area swaps. Title-less by design — never fakes a page name before the
// target route resolves.
export default function PagesLoading() {
  return <PageSkeleton width="wide" label="Loading page" />;
}
