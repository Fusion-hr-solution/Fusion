import { PageSkeleton } from "@repo/ds/shell";

// Route-group loading boundary: renders INSIDE PerformancePagesShell (the frame
// persists) so a route transition shows one localized in-frame skeleton in the
// content region — never a bare full-screen skeleton that erases navigation.
export default function PagesLoading() {
  return <PageSkeleton rows={4} label="Loading" />;
}
