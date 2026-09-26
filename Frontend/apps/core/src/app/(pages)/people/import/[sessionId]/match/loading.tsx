import { ImportMatchSkeleton } from "@/features/data-import/components/import-skeletons";

// Renders inside the attempt frame, so only the Match body loads; the header stays.
export default function WorkforceImportMatchLoading() {
  return <ImportMatchSkeleton />;
}
