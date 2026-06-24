import { CorePageLoadingState } from "@/components/core-page-loading-state";

export default function PagesLoading() {
  return (
    <CorePageLoadingState
      title="Overview"
      description="Loading the next page."
      message="Loading page..."
      variant="workspace"
    />
  );
}
