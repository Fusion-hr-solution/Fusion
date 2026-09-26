import { ImportReviewSkeleton } from "@/features/data-import/components/import-skeletons";

// Renders inside the attempt frame, so only the Review body loads; the header stays.
export default function WorkforceImportReviewLoading() {
  return <ImportReviewSkeleton domain="workforce" />;
}
