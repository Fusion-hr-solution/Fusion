"use client";

import { useMemo, useState } from "react";
import { ChevronDown, ChevronUp, Plus } from "lucide-react";
import { createPlatformApiClient } from "@repo/api";
import { useApiQuery, useApiMutation } from "@repo/api/query";
import { performancePaths, performanceQueryKeys } from "@repo/api";
import { hasCorePermission, useAuth } from "@repo/auth";
import type { CategoryDto, CreateCategoryRequest, RenameCategoryRequest } from "@repo/api";
import { StatusBadge } from "@repo/ds/shell";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

function toCode(name: string): string {
  return name
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "_")
    .replace(/^_|_$/g, "")
    .slice(0, 20);
}

export function TemplateCategoriesManager() {
  const apiClient = useMemo(() => createPlatformApiClient(), []);
  const [showCreate, setShowCreate] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showArchived, setShowArchived] = useState(false);
  const { user, isLoading: authLoading } = useAuth();
  const canManageCategories = hasCorePermission(user, "performance.template.category.manage", "Tenant");

  const categoryQueryKey = [
    ...performanceQueryKeys.templateCategories(),
    showArchived ? "with-archived" : "active-only",
  ] as const;

  const { data: categories, refetch } = useApiQuery<CategoryDto[]>(
    categoryQueryKey,
    (signal) =>
      apiClient.get<CategoryDto[]>(
        `${performancePaths.templateCategories()}${showArchived ? "?includeArchived=true" : ""}`,
        { signal },
      ),
    { enabled: canManageCategories },
  );

  const createCategory = useApiMutation<CategoryDto, CreateCategoryRequest>(
    (data) => apiClient.post<CategoryDto>(performancePaths.templateCategories(), data),
    {
      invalidateQueries: [{ queryKey: performanceQueryKeys.templateCategories(), exact: false }],
      onSuccess: () => { toast.success("Category created"); void refetch(); setShowCreate(false); },
      onError: (err) => { toast.error(err.message); },
    },
  );

  const renameCategory = useApiMutation<CategoryDto, { id: string; req: RenameCategoryRequest }>(
    ({ id, req }) => apiClient.put<CategoryDto>(performancePaths.templateCategory(id), req),
    {
      invalidateQueries: [{ queryKey: performanceQueryKeys.templateCategories(), exact: false }],
      onSuccess: () => { toast.success("Category renamed"); void refetch(); setEditingId(null); },
      onError: (err) => { toast.error(err.message); },
    },
  );

  const archiveCategory = useApiMutation<CategoryDto, string>(
    (id) => apiClient.post<CategoryDto>(performancePaths.templateCategoryArchive(id)),
    {
      invalidateQueries: [{ queryKey: performanceQueryKeys.templateCategories(), exact: false }],
      onSuccess: () => { toast.success("Category archived"); void refetch(); },
      onError: (err) => { toast.error(err.message); },
    },
  );

  const reactivateCategory = useApiMutation<CategoryDto, string>(
    (id) => apiClient.post<CategoryDto>(performancePaths.templateCategoryReactivate(id)),
    {
      invalidateQueries: [{ queryKey: performanceQueryKeys.templateCategories(), exact: false }],
      onSuccess: () => { toast.success("Category restored"); void refetch(); },
      onError: (err) => { toast.error(err.message); },
    },
  );

  if (authLoading || !canManageCategories) return null;

  const active = (categories ?? []).filter((c) => c.status === "Active");
  const archived = (categories ?? []).filter((c) => c.status === "Archived");

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-foreground">Categories</span>
        <div className="flex gap-2">
          {archived.length > 0 && (
            <Button variant="ghost" size="sm" onClick={() => setShowArchived(!showArchived)}>
              {showArchived ? <ChevronUp className="h-3.5 w-3.5 mr-1" /> : <ChevronDown className="h-3.5 w-3.5 mr-1" />}
              {showArchived ? "Hide archived" : `${archived.length} archived`}
            </Button>
          )}
          <Button size="sm" variant="outline" onClick={() => setShowCreate(true)} disabled={showCreate}>
            <Plus className="h-3.5 w-3.5 mr-1" />
            New category
          </Button>
        </div>
      </div>

      {showCreate && (
        <CreateCategoryForm
          onSubmit={(req) => createCategory.mutate(req)}
          onCancel={() => setShowCreate(false)}
          isLoading={createCategory.isLoading}
        />
      )}

      <div className="space-y-1.5">
        {active.map((cat) => (
          <CategoryRow
            key={cat.id}
            cat={cat}
            isEditing={editingId === cat.id}
            onEdit={() => setEditingId(cat.id)}
            onRename={(req) => renameCategory.mutate({ id: cat.id, req })}
            onCancelEdit={() => setEditingId(null)}
            onArchive={() => archiveCategory.mutate(cat.id)}
            isRenaming={renameCategory.isLoading}
            isArchiving={archiveCategory.isLoading}
          />
        ))}

        {showArchived && archived.map((cat) => (
          <Card key={cat.id} className="opacity-60">
            <CardContent className="py-2 px-4 flex items-center gap-3">
              <span className="flex-1 text-sm text-muted-foreground">{cat.name}</span>
              <StatusBadge tone="muted">Archived</StatusBadge>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => reactivateCategory.mutate(cat.id)}
                disabled={reactivateCategory.isLoading}
              >
                Restore
              </Button>
            </CardContent>
          </Card>
        ))}

        {active.length === 0 && !showCreate && (
          <p className="text-xs text-muted-foreground py-1">
            No categories yet — create one to organise your templates.
          </p>
        )}
      </div>
    </div>
  );
}

function CategoryRow({
  cat, isEditing, onEdit, onRename, onCancelEdit, onArchive, isRenaming, isArchiving,
}: {
  cat: CategoryDto;
  isEditing: boolean;
  onEdit: () => void;
  onRename: (req: RenameCategoryRequest) => void;
  onCancelEdit: () => void;
  onArchive: () => void;
  isRenaming: boolean;
  isArchiving: boolean;
}) {
  return (
    <Card>
      <CardContent className="py-2 px-4 flex items-center gap-3">
        {isEditing ? (
          <RenameCategoryForm
            current={cat.name}
            onSubmit={onRename}
            onCancel={onCancelEdit}
            isLoading={isRenaming}
          />
        ) : (
          <>
            <span className="flex-1 text-sm">{cat.name}</span>
            <div className="flex gap-1">
              <Button variant="ghost" size="sm" onClick={onEdit}>Rename</Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={onArchive}
                disabled={isArchiving}
                className="text-muted-foreground hover:text-destructive"
              >
                Archive
              </Button>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

function CreateCategoryForm({
  onSubmit, onCancel, isLoading,
}: {
  onSubmit: (req: CreateCategoryRequest) => void;
  onCancel: () => void;
  isLoading: boolean;
}) {
  const [name, setName] = useState("");
  const derivedCode = toCode(name);

  return (
    <Card>
      <CardContent className="py-3 px-4 space-y-3">
        <div className="space-y-1.5">
          <Label htmlFor="catName">Category name</Label>
          <Input
            id="catName"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Leadership"
            autoFocus
          />
          {name && (
            <p className="text-xs text-muted-foreground">
              Code: <span className="font-mono">{derivedCode}</span>
            </p>
          )}
        </div>
        <div className="flex gap-2">
          <Button
            size="sm"
            onClick={() => onSubmit({ code: derivedCode, name })}
            disabled={isLoading || !name || !derivedCode}
          >
            {isLoading ? "Creating…" : "Create"}
          </Button>
          <Button size="sm" variant="ghost" onClick={onCancel}>Cancel</Button>
        </div>
      </CardContent>
    </Card>
  );
}

function RenameCategoryForm({
  current, onSubmit, onCancel, isLoading,
}: {
  current: string;
  onSubmit: (req: RenameCategoryRequest) => void;
  onCancel: () => void;
  isLoading: boolean;
}) {
  const [name, setName] = useState(current);
  return (
    <div className="flex items-center gap-2 flex-1">
      <Input
        value={name}
        onChange={(e) => setName(e.target.value)}
        className="h-7 text-sm"
        autoFocus
      />
      <Button
        size="sm"
        onClick={() => onSubmit({ name })}
        disabled={isLoading || !name || name === current}
      >
        {isLoading ? "Saving…" : "Save"}
      </Button>
      <Button size="sm" variant="ghost" onClick={onCancel}>Cancel</Button>
    </div>
  );
}
