import { TrainingCatalog } from "@/components";
import { MOCK_TRAININGS } from "@/data/trainings";
import { getTrainings, getCategories } from "@/services/learning-service";
import { CATEGORY_MAP } from "@/types/backend-dtos";
import type { TrainingCategory, TrainingType } from "@/types";
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

  // Resolve frontend category enum → backend UUID for server-side filtering
  let categoryId: string | undefined;
  if (categoryParam) {
    try {
      const cats = await getCategories();
      const matched = cats.find((c) => CATEGORY_MAP[c.name] === categoryParam);
      categoryId = matched?.id;
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
    return (
      <AdminRedirectGuard>
        <TrainingCatalog
          trainings={result.trainings}
          totalCount={result.totalCount}
          page={page}
          pageSize={PAGE_SIZE}
        />
      </AdminRedirectGuard>
    );
  } catch (err) {
    console.warn("[LearningPage] Backend unavailable, using mock data:", err);
    const start = (page - 1) * PAGE_SIZE;
    return (
      <AdminRedirectGuard>
        <TrainingCatalog
          trainings={MOCK_TRAININGS.slice(start, start + PAGE_SIZE)}
          totalCount={MOCK_TRAININGS.length}
          page={page}
          pageSize={PAGE_SIZE}
        />
      </AdminRedirectGuard>
    );
  }
}
