"use client";

import { useState, useCallback } from "react";
import {
  Plus,
  Pencil,
  Trash2,
  FolderOpen,
} from "lucide-react";
import {
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@repo/ui";
import { useApiQuery, useApiMutation } from "@repo/api/react";
import {
  getAdminCategories,
  deleteCategory,
} from "@/services/admin-service";
import type { AdminCategory } from "@/types/admin";
import { CategoryForm } from "./category-form";

export function CategoriesManager() {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);

  const { data: categories, isLoading, refetch } = useApiQuery<AdminCategory[]>(
    () => getAdminCategories(),
    { enabled: true },
  );

  const { mutateAsync: doDelete } = useApiMutation(
    (id: string) => deleteCategory(id),
    { onSuccess: () => refetch() },
  );

  const handleDelete = useCallback(
    async (cat: AdminCategory) => {
      if (cat.trainingCount > 0) {
        alert(`Cannot delete "${cat.name}" — it has ${cat.trainingCount} training(s) assigned.`);
        return;
      }
      if (!confirm(`Delete category "${cat.name}"?`)) return;
      await doDelete(cat.id);
    },
    [doDelete],
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            Manage Categories
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Organize trainings into categories
          </p>
        </div>
        <Button
          onClick={() => { setShowCreate(true); setEditingId(null); }}
          className="ey-bg-dark hover:opacity-90"
        >
          <Plus className="mr-2 h-4 w-4" />
          New Category
        </Button>
      </div>

      {/* Create form */}
      {showCreate && (
        <CategoryForm
          onSaved={() => { setShowCreate(false); refetch(); }}
          onCancel={() => setShowCreate(false)}
        />
      )}

      {/* List */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12 text-sm text-muted-foreground">
          Loading categories...
        </div>
      ) : !categories?.length ? (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <FolderOpen className="h-10 w-10 text-muted-foreground/40 mb-3" />
          <p className="text-sm text-muted-foreground">No categories yet</p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {categories.map((cat) =>
            editingId === cat.id ? (
              <CategoryForm
                key={cat.id}
                category={cat}
                onSaved={() => { setEditingId(null); refetch(); }}
                onCancel={() => setEditingId(null)}
              />
            ) : (
              <Card key={cat.id} className="border-border/60">
                <CardHeader className="flex flex-row items-start justify-between pb-2">
                  <div className="space-y-1">
                    <CardTitle className="text-sm font-semibold">{cat.name}</CardTitle>
                    {cat.description && (
                      <p className="text-xs text-muted-foreground line-clamp-2">
                        {cat.description}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => { setEditingId(cat.id); setShowCreate(false); }}
                      aria-label={`Edit ${cat.name}`}
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDelete(cat)}
                      aria-label={`Delete ${cat.name}`}
                      className="text-[hsl(var(--ey-red-500))] hover:text-[hsl(var(--ey-red-500))] hover:bg-[hsl(var(--ey-red-500))]/10"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="pt-0">
                  <p className="text-xs text-muted-foreground">
                    {cat.trainingCount} training{cat.trainingCount !== 1 ? "s" : ""}
                  </p>
                </CardContent>
              </Card>
            ),
          )}
        </div>
      )}
    </div>
  );
}
