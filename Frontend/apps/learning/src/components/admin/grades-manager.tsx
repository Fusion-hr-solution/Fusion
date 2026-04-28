"use client";

import { useState, useCallback } from "react";
import { Plus, Pencil, Trash2, Layers } from "lucide-react";
import {
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Badge,
} from "@repo/ui";
import { useApiQuery, useApiMutation } from "@repo/api/react";
import { getGrades, deleteGrade } from "@/services/admin-service";
import type { AdminGrade } from "@/types/admin";
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
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            Manage Grades
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Define the grade hierarchy for curriculum mapping
          </p>
        </div>
        <Button
          onClick={() => { setShowCreate(true); setEditingId(null); }}
          className="ey-bg-dark hover:opacity-90"
        >
          <Plus className="mr-2 h-4 w-4" />
          New Grade
        </Button>
      </div>

      {showCreate && (
        <GradeForm
          onSaved={() => { setShowCreate(false); refetch(); }}
          onCancel={() => setShowCreate(false)}
        />
      )}

      {isLoading ? (
        <div className="flex items-center justify-center py-12 text-sm text-muted-foreground">
          Loading grades...
        </div>
      ) : !sorted.length ? (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <Layers className="h-10 w-10 text-muted-foreground/40 mb-3" />
          <p className="text-sm text-muted-foreground">No grades yet</p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {sorted.map((grade) =>
            editingId === grade.id ? (
              <GradeForm
                key={grade.id}
                grade={grade}
                onSaved={() => { setEditingId(null); refetch(); }}
                onCancel={() => setEditingId(null)}
              />
            ) : (
              <Card key={grade.id} className="border-border/60">
                <CardHeader className="flex flex-row items-start justify-between pb-2">
                  <div className="space-y-1">
                    <CardTitle className="text-sm font-semibold">{grade.name}</CardTitle>
                    {grade.description && (
                      <p className="text-xs text-muted-foreground line-clamp-2">
                        {grade.description}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-1">
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
                      className="text-destructive hover:text-destructive hover:bg-destructive/10"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="pt-0">
                  <Badge variant="secondary" className="text-xs">
                    Level {grade.level}
                  </Badge>
                </CardContent>
              </Card>
            ),
          )}
        </div>
      )}
    </div>
  );
}
