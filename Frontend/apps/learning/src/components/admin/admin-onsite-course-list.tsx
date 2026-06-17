"use client";

import { useState } from "react";
import { Plus, Trash2, GripVertical, FileText, Pencil } from "lucide-react";
import { Button, Card, CardContent, Input, Label } from "@repo/ui";
import { useApiMutation } from "@repo/api/react";
import {
  addOnSiteCourse,
  updateOnSiteCourse,
  deleteOnSiteCourse,
  reorderOnSiteCourses,
  uploadChapterFile,
} from "@/services/admin-service";
import type { AdminOnSiteCourse, CreateOnSiteCourseInput } from "@/types/admin";

interface AdminOnSiteCourseListProps {
  trainingId: string;
  courses: AdminOnSiteCourse[];
  isDeleted: boolean;
  onRefetch: () => void;
}

export function AdminOnSiteCourseList({
  trainingId,
  courses,
  isDeleted,
  onRefetch,
}: AdminOnSiteCourseListProps) {
  const [showForm, setShowForm] = useState(false);
  const [editingCourse, setEditingCourse] = useState<AdminOnSiteCourse | null>(null);
  const [title, setTitle] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);

  const { mutateAsync: doAdd } = useApiMutation(
    (input: CreateOnSiteCourseInput) => addOnSiteCourse(trainingId, input),
    { onSuccess: () => { onRefetch(); resetForm(); } },
  );

  const { mutateAsync: doUpdate } = useApiMutation(
    ({ id, input }: { id: string; input: CreateOnSiteCourseInput }) =>
      updateOnSiteCourse(trainingId, id, input),
    { onSuccess: () => { onRefetch(); resetForm(); } },
  );

  const { mutateAsync: doDelete } = useApiMutation(
    (courseId: string) => deleteOnSiteCourse(trainingId, courseId),
    { onSuccess: onRefetch },
  );

  const { mutateAsync: doReorder } = useApiMutation(
    (courseIds: string[]) => reorderOnSiteCourses(trainingId, courseIds),
    { onSuccess: onRefetch },
  );

  function resetForm() {
    setShowForm(false);
    setEditingCourse(null);
    setTitle("");
    setFile(null);
  }

  function handleEdit(course: AdminOnSiteCourse) {
    setEditingCourse(course);
    setTitle(course.title);
    setFile(null);
    setShowForm(true);
  }

  async function handleSubmit() {
    if (!title.trim()) return;
    setUploading(true);
    try {
      let contentUri = editingCourse?.contentUri ?? "";
      if (file) {
        contentUri = await uploadChapterFile(file);
      }
      if (!contentUri) return;

      const input: CreateOnSiteCourseInput = {
        title: title.trim(),
        contentUri,
        orderIndex: editingCourse?.orderIndex ?? courses.length,
      };

      if (editingCourse) {
        await doUpdate({ id: editingCourse.id, input });
      } else {
        await doAdd(input);
      }
    } finally {
      setUploading(false);
    }
  }

  async function handleDelete(course: AdminOnSiteCourse) {
    if (!confirm(`Delete course "${course.title}"?`)) return;
    await doDelete(course.id);
  }

  async function handleMoveUp(index: number) {
    if (index === 0) return;
    const ids = courses.map((c) => c.id);
    const temp = ids[index - 1];
    ids[index - 1] = ids[index]!;
    ids[index] = temp!;
    await doReorder(ids);
  }

  async function handleMoveDown(index: number) {
    if (index >= courses.length - 1) return;
    const ids = courses.map((c) => c.id);
    const temp = ids[index];
    ids[index] = ids[index + 1]!;
    ids[index + 1] = temp!;
    await doReorder(ids);
  }

  const sorted = [...courses].sort((a, b) => a.orderIndex - b.orderIndex);

  return (
    <div className="space-y-4">
      {sorted.length === 0 && !showForm && (
        <Card className="border-dashed border-border/60">
          <CardContent className="flex flex-col items-center justify-center py-8 text-center">
            <FileText className="h-8 w-8 text-muted-foreground/50" />
            <p className="mt-2 text-sm text-muted-foreground">
              No courses added yet. Add PDF course materials for this on-site training.
            </p>
            {!isDeleted && (
              <Button
                variant="outline"
                size="sm"
                className="mt-3"
                onClick={() => setShowForm(true)}
              >
                <Plus className="mr-1.5 h-4 w-4" />
                Add Course
              </Button>
            )}
          </CardContent>
        </Card>
      )}

      {sorted.map((course, index) => (
        <Card key={course.id} className="border-border/60">
          <CardContent className="flex items-center gap-3 py-3">
            <GripVertical className="h-4 w-4 shrink-0 text-muted-foreground/50" />
            <FileText className="h-5 w-5 shrink-0 text-destructive" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{course.title}</p>
              <p className="text-xs text-muted-foreground truncate">{course.contentUri}</p>
            </div>
            {!isDeleted && (
              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 w-7 p-0"
                  onClick={() => handleMoveUp(index)}
                  disabled={index === 0}
                >
                  ↑
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 w-7 p-0"
                  onClick={() => handleMoveDown(index)}
                  disabled={index >= sorted.length - 1}
                >
                  ↓
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 w-7 p-0"
                  onClick={() => handleEdit(course)}
                >
                  <Pencil className="h-3.5 w-3.5" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 w-7 p-0 text-destructive hover:text-destructive"
                  onClick={() => handleDelete(course)}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      ))}

      {showForm && (
        <Card className="border-primary/30 bg-primary/5">
          <CardContent className="space-y-3 py-4">
            <div className="space-y-2">
              <Label htmlFor="courseTitle">Course Title *</Label>
              <Input
                id="courseTitle"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Module 1 - Introduction"
                maxLength={200}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="courseFile">
                PDF File {editingCourse ? "(leave empty to keep current)" : "*"}
              </Label>
              <Input
                id="courseFile"
                type="file"
                accept=".pdf"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              />
            </div>
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                onClick={handleSubmit}
                disabled={uploading || !title.trim() || (!file && !editingCourse)}
              >
                {uploading ? "Uploading..." : editingCourse ? "Update" : "Add"}
              </Button>
              <Button variant="outline" size="sm" onClick={resetForm}>
                Cancel
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {sorted.length > 0 && !showForm && !isDeleted && (
        <Button variant="outline" size="sm" onClick={() => setShowForm(true)}>
          <Plus className="mr-1.5 h-4 w-4" />
          Add Course
        </Button>
      )}
    </div>
  );
}
