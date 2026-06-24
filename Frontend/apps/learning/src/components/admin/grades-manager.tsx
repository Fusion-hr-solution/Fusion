"use client";

import { useState, useCallback } from "react";
import { Plus, Pencil, Trash2, Layers } from "lucide-react";
import {
  Button,
  Card,
  CardContent,
  Skeleton,
} from "@repo/ui";
import { useApiQuery, useApiMutation } from "@repo/api/react";
import { getGrades, deleteGrade } from "@/services/admin-service";
import type { AdminGrade } from "@/types/admin";
import { PageHeader } from "../page-header";
import { EmptyState } from "../empty-state";
import { GradeForm } from "./grade-form";

export function GradesManager() {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);

  const fetchGrades = useCallback(() => getGrades(), []);
  const { data: grades, isLoading, refetch } = useApiQuery<AdminGrade[]>(
    fetchGrades,
    { enabled: true },
  );

  const { mutateAsync: doDelete } = useApiMutation(
    (id: string) => deleteGrade(id),
    { onSuccess: () => refetch() },
  );

  const handleDelete = useCallback(
    async (grade: AdminGrade) => {
      if (!confirm(`Delete grade "${grade.name}"?`)) return;
      await doDelete(grade.id);
    },
    [doDelete],
  );

  const sorted = grades?.slice().sort((a, b) => a.level - b.level) ?? [];

  return (
    <>
      <PageHeader
        moduleTitle="Administration"
        title="Manage Grades"
        description="Define the grade hierarchy that powers curriculum mapping and progression."
      >
        <div className="ey-animate-fade-up mt-6" style={{ animationDelay: "200ms" }}>
          <Button
            onClick={() => { setShowCreate(true); setEditingId(null); }}
            className="ey-bg-dark text-white shadow-sm hover:bg-[hsl(var(--ey-black))] hover:shadow-md"
          >
            <Plus className="mr-2 h-4 w-4" />
            New Grade
          </Button>
        </div>
      </PageHeader>

      <section className="space-y-6 px-8 py-8">
        {showCreate && (
          <GradeForm
            onSaved={() => { setShowCreate(false); refetch(); }}
            onCancel={() => setShowCreate(false)}
          />
        )}

        {isLoading ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-28 rounded-xl" />
            ))}
          </div>
        ) : !sorted.length ? (
          <Card className="border-border/60 py-4">
            <EmptyState
              icon={Layers}
              title="No grades yet"
              subtitle="Create your first grade to start mapping curricula by seniority."
            />
          </Card>
        ) : (
          <div className="ey-stagger-grid grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {sorted.map((grade) =>
              editingId === grade.id ? (
                <GradeForm
                  key={grade.id}
                  grade={grade}
                  onSaved={() => { setEditingId(null); refetch(); }}
                  onCancel={() => setEditingId(null)}
                />
              ) : (
                <Card
                  key={grade.id}
                  className="group border-border/60 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-md"
                >
                  <CardContent className="p-5">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex min-w-0 items-center gap-3">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/15 text-sm font-bold tabular-nums text-foreground">
                          {grade.level}
                        </div>
                        <div className="min-w-0">
                          <p className="truncate font-semibold text-foreground">{grade.name}</p>
                          <p className="text-xs text-muted-foreground">Level {grade.level}</p>
                        </div>
                      </div>
                      <div className="flex shrink-0 items-center gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => { setEditingId(grade.id); setShowCreate(false); }}
                          aria-label={`Edit ${grade.name}`}
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDelete(grade)}
                          aria-label={`Delete ${grade.name}`}
                          className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                    {grade.description && (
                      <p className="mt-3 line-clamp-2 text-xs leading-relaxed text-muted-foreground">
                        {grade.description}
                      </p>
                    )}
                  </CardContent>
                </Card>
              ),
            )}
          </div>
        )}
      </section>
    </>
  );
}
