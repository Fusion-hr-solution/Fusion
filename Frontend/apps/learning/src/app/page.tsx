import { TrainingCatalog } from "@/components";
import { getTrainings, getCategories, getSemanticSearch } from "@/services/learning-service";
import { CATEGORY_MAP } from "@/types/backend-dtos";
import type { Training, TrainingCategory, TrainingType } from "@/types";
import { AdminRedirectGuard } from "@/components/admin-redirect-guard";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 10;

export default async function LearningPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; search?: string; category?: string; trainingType?: string }>;
}) {
  const params = await searchParams;
  const page = Math.max(1, parseInt(params.page ?? "1", 10) || 1);
  const search = params.search?.trim() ?? "";
  const categoryParam = params.category as TrainingCategory | undefined;
  const trainingType =
    params.trainingType === "ELearning" || params.trainingType === "OnSite"
      ? (params.trainingType as TrainingType)
      : undefined;

  // Resolve frontend category enum → backend UUID (keyword filter) + backend name (the
  // semantic endpoint filters Course Vectors by category_name).
  let categoryId: string | undefined;
  let categoryName: string | undefined;
  if (categoryParam) {
    try {
      const cats = await getCategories();
      const matched = cats.find((c) => CATEGORY_MAP[c.name] === categoryParam);
      categoryId = matched?.id;
      categoryName = matched?.name;
    } catch {
      // Ignore — fetch without category filter if categories endpoint is unavailable
    }
  }

  try {
    const result = await getTrainings({
      page,
      pageSize: PAGE_SIZE,
      search: search || undefined,
      categoryId,
      trainingType,
    });

    // Keyword-first / semantic-fallback (AI-L-5, L5-2): only when the substring search finds
    // nothing for a non-empty query do we ask the ai-service for meaning-matched courses. Gate
    // on totalCount (not the current page slice) so an out-of-range page of a non-empty keyword
    // result never spuriously enters semantic mode. getSemanticSearch is fail-soft (→ []), so a
    // down ai-service leaves the keyword result.
    let semanticTrainings: Training[] = [];
    if (search && result.totalCount === 0) {
      semanticTrainings = await getSemanticSearch(search, { category: categoryName, trainingType });
    }
    const semanticMode = semanticTrainings.length > 0;

    return (
      <AdminRedirectGuard>
        <TrainingCatalog
          trainings={semanticMode ? semanticTrainings : result.trainings}
          totalCount={semanticMode ? semanticTrainings.length : result.totalCount}
          page={page}
          pageSize={PAGE_SIZE}
          semanticMode={semanticMode}
        />
      </AdminRedirectGuard>
    );
  } catch (err) {
    console.error("[LearningPage] Failed to load the training catalog:", err);
    return (
      <AdminRedirectGuard>
        <div className="flex min-h-[60vh] flex-col items-center justify-center gap-2 px-8 text-center">
          <p className="text-sm font-semibold text-foreground">We couldn&apos;t load the catalog</p>
          <p className="max-w-sm text-sm text-muted-foreground">
            The training service is unavailable right now. Refresh the page to try again.
          </p>
        </div>
      </AdminRedirectGuard>
    );
  }
}
