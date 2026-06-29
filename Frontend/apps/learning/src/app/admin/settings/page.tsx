import { CategoriesManager } from "@/components/admin/categories-manager";
import { PdfBackfillCard } from "@/components/admin/pdf-backfill-card";

export default function AdminSettingsPage() {
  return (
    <div className="space-y-6 p-6">
      <CategoriesManager />
      <PdfBackfillCard />
    </div>
  );
}
