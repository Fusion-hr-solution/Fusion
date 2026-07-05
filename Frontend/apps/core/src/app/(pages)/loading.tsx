import { PageSkeleton } from "@repo/ds/shell";

// Route-group loading boundary: renders INSIDE CorePagesShell, so the app
// frame persists during core→core transitions and only the content area
// shows the neutral skeleton. Title-less by design — the page's own
// loading state supplies the real header once it mounts.
export default function PagesLoading() {
  return <PageSkeleton label="Loading page" />;
}
