import { ImportMatchSkeleton } from "@/features/organization-import/components/import-skeletons";

// Renders inside the attempt frame, so only the Match body loads; the header stays.
export default function OrganizationImportMatchLoading() {
  return <ImportMatchSkeleton />;
}