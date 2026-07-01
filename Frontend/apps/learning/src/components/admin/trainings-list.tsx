"use client";

import { useState, useCallback } from "react";
import Link from "next/link";
import { Plus, BookOpen } from "lucide-react";
import { useTranslations } from "next-intl";
import {
  Card,
  Skeleton,
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
} from "@repo/ui";
import { useApiQuery, useApiMutation } from "@repo/api/react";
import { getAdminTrainings, deleteTraining, getAdminCategories } from "@/services/admin-service";
import type { AdminCategory } from "@/types/admin";
import { PageHeader } from "../page-header";
import { EmptyState } from "../empty-state";
import { TrainingRow } from "./training-row";
import { PaginationBar } from "./pagination-bar";
import { TrainingsFilterBar } from "./trainings-filter-bar";

export function TrainingsList() {
  const t = useTranslations("adminTrainings");
  const [search, setSearch] = useState("");
  const [categoryId, setCategoryId] = useState<string>("");
  const [includeDeleted, setIncludeDeleted] = useState(false);
  const [page, setPage] = useState(1);
  const pageSize = 10;

  const fetchTrainings = useCallback(
    () => getAdminTrainings({ search: search || undefined, categoryId: categoryId || undefined, includeDeleted, page, pageSize }),
    [search, categoryId, includeDeleted, page, pageSize],
  );

  const fetchCategories = useCallback(
    () => getAdminCategories(),
    [],
  );

  const { data, isLoading, refetch } = useApiQuery(
    fetchTrainings,
    { enabled: true },
  );

  const { data: categories } = useApiQuery<AdminCategory[]>(
    fetchCategories,
    { enabled: true },
  );

  const { mutateAsync: remove, isLoading: isDeleting } = useApiMutation(
    (id: string) => deleteTraining(id),
    { onSuccess: () => refetch() },
  );

  const handleDelete = useCallback(
    async (id: string, title: string) => {
      if (!confirm(t("list.confirmDelete", { title }))) return;
      await remove(id);
    },
    [remove, t],
  );

  const trainings = data?.trainings ?? [];
  const totalCount = data?.totalCount ?? 0;
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));

  return (
    <>
      <PageHeader
        moduleTitle="Administration"
        title={t("list.title")}
        description={t("list.subtitle")}
      >
        <div className="ey-animate-fade-up mt-6" style={{ animationDelay: "200ms" }}>
          <Link
            href="/admin/create"
            className="inline-flex items-center gap-2 rounded-lg ey-bg-dark px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-all hover:bg-[hsl(var(--ey-black))] hover:shadow-md"
          >
            <Plus className="h-4 w-4" aria-hidden="true" />
            {t("list.newTraining")}
          </Link>
        </div>
      </PageHeader>

      <section className="space-y-6 px-8 py-8">
        <TrainingsFilterBar
          search={search}
          onSearchChange={(v) => { setSearch(v); setPage(1); }}
          categoryId={categoryId}
          onCategoryChange={(v) => { setCategoryId(v); setPage(1); }}
          includeDeleted={includeDeleted}
          onIncludeDeletedChange={(v) => { setIncludeDeleted(v); setPage(1); }}
          categories={categories ?? []}
          onRefresh={refetch}
        />

        {isLoading ? (
          <Card className="space-y-3 border-border/60 p-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3">
                <Skeleton className="h-9 w-9 rounded-lg" />
                <Skeleton className="h-4 flex-1 rounded" />
                <Skeleton className="h-5 w-20 rounded-full" />
                <Skeleton className="h-5 w-16 rounded-full" />
              </div>
            ))}
          </Card>
        ) : trainings.length === 0 ? (
          <Card className="border-border/60 py-4">
            <EmptyState
              icon={BookOpen}
              title={t("list.empty")}
              subtitle="Adjust your filters, or create the first training to get started."
            />
          </Card>
        ) : (
          <Card className="overflow-hidden border-border/60">
            <Table>
              <TableHeader>
                <TableRow className="border-border/60 bg-muted/50 hover:bg-muted/50">
                  <TableHead className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t("list.columns.title")}</TableHead>
                  <TableHead className="text-center text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t("list.columns.type")}</TableHead>
                  <TableHead className="text-center text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t("list.columns.content")}</TableHead>
                  <TableHead className="text-center text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t("list.columns.enrolled")}</TableHead>
                  <TableHead className="text-center text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t("list.columns.level")}</TableHead>
                  <TableHead className="text-center text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t("list.columns.status")}</TableHead>
                  <TableHead className="text-right text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t("list.columns.actions")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {trainings.map((t) => (
                  <TrainingRow
                    key={t.id}
                    training={t}
                    isDeleting={isDeleting}
                    viewHref={`/admin/trainings/${t.id}`}
                    editHref={`/admin/trainings/${t.id}/edit`}
                    onDelete={() => handleDelete(t.id, t.title)}
                  />
                ))}
              </TableBody>
            </Table>
          </Card>
        )}

        <PaginationBar
          page={page}
          totalPages={totalPages}
          pageSize={pageSize}
          totalCount={totalCount}
          onPageChange={setPage}
        />
      </section>
    </>
  );
}
