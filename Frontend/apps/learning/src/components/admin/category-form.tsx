"use client";

import { useState } from "react";
import { Loader2, Save, X } from "lucide-react";
import { Button, Card, CardContent, Input, Label } from "@repo/ui";
import { useApiMutation } from "@repo/api/react";
import { createCategory, updateCategory } from "@/services/admin-service";
import type { CreateCategoryInput, UpdateCategoryInput } from "@/types/admin";
import type { CategoryFormProps } from "@/types/admin-props";

export function CategoryForm({ category, onSaved, onCancel }: CategoryFormProps) {
  const isEditing = Boolean(category);
  const [name, setName] = useState(category?.name ?? "");
  const [description, setDescription] = useState(category?.description ?? "");

  const { mutateAsync: doCreate, isLoading: creating } = useApiMutation(
    (input: CreateCategoryInput) => createCategory(input),
    { onSuccess: onSaved },
  );

  const { mutateAsync: doUpdate, isLoading: updating } = useApiMutation(
    (input: UpdateCategoryInput) => updateCategory(category!.id, input),
    { onSuccess: onSaved },
  );

  const isSaving = creating || updating;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const payload = { name, description: description || undefined };
    if (isEditing) await doUpdate(payload);
    else await doCreate(payload);
  }

  return (
    <Card className="border-[hsl(var(--ey-blue-400))]/30 border-2">
      <CardContent className="p-4">
        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="cat-name" className="text-xs">Name *</Label>
            <Input
              id="cat-name"
              required
              maxLength={100}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Category name"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="cat-desc" className="text-xs">Description</Label>
            <Input
              id="cat-desc"
              maxLength={500}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Optional description"
            />
          </div>
          <div className="flex items-center gap-2">
            <Button type="submit" size="sm" disabled={isSaving} className="ey-bg-dark hover:opacity-90">
              {isSaving ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : <Save className="mr-1 h-3.5 w-3.5" />}
              {isEditing ? "Update" : "Create"}
            </Button>
            <Button type="button" variant="ghost" size="sm" onClick={onCancel}>
              <X className="mr-1 h-3.5 w-3.5" /> Cancel
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
