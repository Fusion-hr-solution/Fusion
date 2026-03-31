"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  Plus,
  Search,
  BookOpen,
  RotateCcw,
} from "lucide-react";
import { Button, Input, Card, CardContent } from "@repo/ui";
import { useApiQuery, useApiMutation } from "@repo/api/react";
import { getAdminTrainings, deleteTraining, getAdminCategories } from "@/services/admin-service";
import type { AdminCategory } from "@/types/admin";
import { TrainingRow } from "./training-row";

export function TrainingsList() {
  const router = useRouter();
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
    <div className="space-y-6">
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
        <Button
          onClick={() => router.push("/admin/trainings/new")}
          className="ey-bg-dark hover:opacity-90"
        >
          <Plus className="mr-2 h-4 w-4" />
          New Training
        </Button>
      </div>

      {/* Filters */}
      <Card className="border-border/60">
        <CardContent className="flex flex-wrap items-center gap-3 p-4">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search trainings..."
              className="pl-9"
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            />
          </div>
          <select
            className="h-9 rounded-md border border-input bg-background px-3 text-sm"
            value={categoryId}
            onChange={(e) => { setCategoryId(e.target.value); setPage(1); }}
          >
            <option value="">All Categories</option>
            {categories?.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
          <label className="flex items-center gap-2 text-sm text-muted-foreground">
            <input
              type="checkbox"
              checked={includeDeleted}
              onChange={(e) => { setIncludeDeleted(e.target.checked); setPage(1); }}
              className="rounded border-border"
            />
            Show deleted
          </label>
          <Button variant="outline" size="sm" onClick={() => refetch()}>
            <RotateCcw className="mr-1 h-3.5 w-3.5" />
            Refresh
          </Button>
        </CardContent>
      </Card>

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
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border/60 bg-[hsl(var(--ey-grey-100))]/50">
                  <th className="px-4 py-3 text-left font-semibold text-muted-foreground">Title</th>
                  <th className="px-4 py-3 text-left font-semibold text-muted-foreground">Category</th>
                  <th className="px-4 py-3 text-center font-semibold text-muted-foreground">Chapters</th>
                  <th className="px-4 py-3 text-center font-semibold text-muted-foreground">Enrolled</th>
                  <th className="px-4 py-3 text-center font-semibold text-muted-foreground">Level</th>
                  <th className="px-4 py-3 text-center font-semibold text-muted-foreground">Status</th>
                  <th className="px-4 py-3 text-right font-semibold text-muted-foreground">Actions</th>
                </tr>
              </thead>
              <tbody>
                {trainings.map((t) => (
                  <TrainingRow
                    key={t.id}
                    training={t}
                    isDeleting={isDeleting}
                    onView={() => router.push(`/admin/trainings/${t.id}`)}
                    onEdit={() => router.push(`/admin/trainings/${t.id}/edit`)}
                    onDelete={() => handleDelete(t.id, t.title)}
                  />
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Showing {(page - 1) * pageSize + 1}–{Math.min(page * pageSize, totalCount)} of {totalCount}
          </p>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={page <= 1}
              onClick={() => setPage((p) => p - 1)}
            >
              Previous
            </Button>
            <span className="text-sm text-muted-foreground">
              Page {page} of {totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => p + 1)}
            >
              Next
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
