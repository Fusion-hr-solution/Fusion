import { ImportReviewSkeleton } from "@/features/organization-import/components/import-skeletons";

// Renders inside the attempt frame, so only the Review body loads; the header stays.
export default function OrganizationImportReviewLoading() {
  return <ImportReviewSkeleton />;
}