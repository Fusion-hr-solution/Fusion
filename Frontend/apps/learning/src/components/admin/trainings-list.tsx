"use client";

import { useState, useCallback } from "react";
import Link from "next/link";
import { Plus, BookOpen } from "lucide-react";
import { buttonVariants, Card, Table, TableHeader, TableBody, TableRow, TableHead } from "@repo/ui";
import { useApiQuery, useApiMutation } from "@repo/api/react";
import { getAdminTrainings, deleteTraining, getAdminCategories } from "@/services/admin-service";
import type { AdminCategory } from "@/types/admin";
import { TrainingRow } from "./training-row";
import { PaginationBar } from "./pagination-bar";
import { TrainingsFilterBar } from "./trainings-filter-bar";

export function TrainingsList() {
  const [search, setSearch] = useState("");
  const [categoryId, setCategoryId] = useState<string>("");
  const [includeDeleted, setIncludeDeleted] = useState(false);
  const [page, setPage] = useState(1);
  const pageSize = 10;

  const { data, isLoading, refetch } = useApiQuery(
    () => getAdminTrainings({ search: search || undefined, categoryId: categoryId || undefined, includeDeleted, page, pageSize }),
    { enabled: true },
  );

  const { data: categories } = useApiQuery<AdminCategory[]>(
    () => getAdminCategories(),
    { enabled: true },
  );

  const { mutateAsync: remove, isLoading: isDeleting } = useApiMutation(
    (id: string) => deleteTraining(id),
    { onSuccess: () => refetch() },
  );

  const handleDelete = useCallback(
    async (id: string, title: string) => {
      if (!confirm(`Delete "${title}"? This will soft-delete the training.`)) return;
      await remove(id);
    },
    [remove],
  );

  const trainings = data?.trainings ?? [];
  const totalCount = data?.totalCount ?? 0;
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            Manage Trainings
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Create, edit, and manage training programs
          </p>
        </div>
        <Link
          href="/admin/create"
          className={buttonVariants() + " ey-bg-dark hover:opacity-90"}
        >
          <Plus className="mr-2 h-4 w-4" />
          New Training
        </Link>
      </div>

      {/* Filters */}
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

      {/* Table */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12 text-sm text-muted-foreground">
          Loading trainings...
        </div>
      ) : trainings.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <BookOpen className="h-10 w-10 text-muted-foreground/40 mb-3" />
          <p className="text-sm text-muted-foreground">No trainings found</p>
        </div>
      ) : (
        <Card className="border-border/60 overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50">
                <TableHead>Title</TableHead>
                <TableHead>Category</TableHead>
                <TableHead className="text-center">Chapters</TableHead>
                <TableHead className="text-center">Enrolled</TableHead>
                <TableHead className="text-center">Level</TableHead>
                <TableHead className="text-center">Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
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

      {/* Pagination */}
      <PaginationBar
        page={page}
        totalPages={totalPages}
        pageSize={pageSize}
        totalCount={totalCount}
        onPageChange={setPage}
      />
    </div>
  );
}
