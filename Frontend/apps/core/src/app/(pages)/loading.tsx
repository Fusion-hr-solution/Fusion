import { CorePageLoadingState } from "@/components/core-page-loading-state";

export default function PagesLoading() {
  return (
    <CorePageLoadingState
      title="Core workspace"
      description="Loading the next workspace view."
      message="Loading workspace..."
      variant="workspace"
    />
  );
}
